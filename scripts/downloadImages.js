import fs from "fs-extra";
import path from "path";
import axios from "axios";
import http from "http";
import https from "https";
import crypto from "crypto";
import { fileURLToPath } from "url";

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define storage locations inside `public/`
const PUBLIC_DIR = path.join(__dirname, "../public");
const STATIC_IMAGES_DIR = path.join(PUBLIC_DIR, "static-images");
const DATA_DIR = path.join(PUBLIC_DIR, "data");

// --- Network robustness configuration ---
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1500;   // 1.5s → 3s → 6s exponential backoff
const REQUEST_TIMEOUT = 30000;   // 30 seconds per request
const CONCURRENCY_LIMIT = 1;     // Sequential downloads to avoid Cloudflare rate limits
const DELAY_BETWEEN_REQUESTS = 300; // 300ms pause between consecutive downloads

// Browser-like User-Agent to prevent Cloudflare bot detection from resetting connections
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "*/*",
};

// Fresh sockets per request, forced IPv4 to avoid IPv6 resolution issues with Cloudflare
const httpAgent = new http.Agent({ keepAlive: false, family: 4 });
const httpsAgent = new https.Agent({ keepAlive: false, family: 4 });

/**
 * Process an array of items with limited concurrency.
 * Preserves result order. Workers pull the next available index when idle.
 */
async function downloadWithConcurrency(items, mapFn, concurrency = CONCURRENCY_LIMIT) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const i = nextIndex++;
            // Small delay between requests to avoid overwhelming Cloudflare edge
            if (i > 0) {
                await new Promise((r) => setTimeout(r, DELAY_BETWEEN_REQUESTS));
            }
            results[i] = await mapFn(items[i], i);
        }
    }

    await Promise.all(
        Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
    );
    return results;
}

/**
 * Retryable helper for checking transient network errors.
 */
function isRetryableError(error) {
    return (
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ECONNABORTED" ||
        error.code === "EPIPE" ||
        error.code === "EAI_AGAIN" ||
        error.code === "ENOTFOUND" ||
        error.code === "ECONNREFUSED" ||
        (error.response && error.response.status >= 500)
    );
}

// Function to clean the directories before downloading new files
async function cleanDirectories() {
    console.log("🧹 Cleaning up old data...");

    try {
        await fs.remove(STATIC_IMAGES_DIR); // Delete existing images folder
        await fs.remove(DATA_DIR); // Delete existing data folder

        await fs.ensureDir(STATIC_IMAGES_DIR); // Recreate empty folder
        await fs.ensureDir(DATA_DIR);

        console.log("✅ Cleanup complete!");
    } catch (error) {
        console.error("❌ Error while cleaning directories:", error.message);
    }
}

// Cloudflare KV URLs
const jsonUrls = {
    "homepage": "https://backend.sillybillysilkies.workers.dev/cms/homepage.json",
    "breeds/holland_lop": "https://backend.sillybillysilkies.workers.dev/cms/breeds/holland_lop.json",
    "breeds/netherland_dwarf": "https://backend.sillybillysilkies.workers.dev/cms/breeds/netherland_dwarf.json",
    "gallery": "https://backend.sillybillysilkies.workers.dev/cms/gallery.json",
    "goats": "https://backend.sillybillysilkies.workers.dev/cms/goats.json",
    "profile": "https://backend.sillybillysilkies.workers.dev/GetProfilePic",
};

/**
 * Builds the saved file name for a downloaded image. A short hash of the source URL
 * is part of the name, so when a photo is replaced in the admin (the backend gives every
 * upload a new URL) the website serves it at a NEW address. Reusing the old address let
 * browsers/CDN keep showing the previous photo.
 */
function staticFilename(baseName, sourceUrl) {
    const hash = crypto.createHash("sha1").update(String(sourceUrl)).digest("hex").slice(0, 10);
    let ext = "";
    try {
        ext = path.extname(new URL(sourceUrl, "https://x").pathname);
    } catch {
        ext = path.extname(String(sourceUrl).split("?")[0]);
    }
    return `${baseName}-${hash}${(ext || ".jpg").toLowerCase()}`;
}

/**
 * Downloads an image and saves it in `public/static-images/` under the correct subdirectory
 */
async function downloadImage(url, folder, filename) {
    const saveDir = path.join(STATIC_IMAGES_DIR, folder);
    await fs.ensureDir(saveDir);

    const savePath = path.join(saveDir, filename);
    const relativePath = `/static-images/${folder}/${filename}`; // Web-friendly path

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Synchronize log output to avoid stdout interleaving under concurrency
            const tag = attempt > 1 ? ` (attempt ${attempt}/${MAX_RETRIES})` : "";
            console.log(`⬇️  Downloading${tag}: ${url}`);

            const response = await axios({
                url,
                responseType: "arraybuffer",
                timeout: REQUEST_TIMEOUT,
                httpAgent,
                httpsAgent,
                headers: HEADERS,
            });

            await fs.writeFile(savePath, response.data);
            console.log(`✅ Saved: ${relativePath}`);
            return relativePath;
        } catch (error) {
            const isRetryable = isRetryableError(error);

            if (isRetryable && attempt < MAX_RETRIES) {
                const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
                console.warn(`⚠️  Attempt ${attempt} failed for ${filename}: ${error.code || error.message}. Retrying in ${delay}ms...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
                console.error(`❌ Failed to download ${url} after ${attempt} attempt(s): ${error.message}`);
                return url; // Return original URL if all retries exhausted
            }
        }
    }
    return url;
}

/**
 * Fetch JSON from Cloudflare KV and process images
 */
async function processJson(key, url) {
    try {
        // Fetch JSON with retry logic (same robustness as image downloads)
        let data;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const tag = attempt > 1 ? ` (attempt ${attempt}/${MAX_RETRIES})` : "";
                console.log(`🔄 Fetching JSON${tag}: ${url}`);
                const response = await axios.get(url, {
                    timeout: REQUEST_TIMEOUT,
                    httpAgent,
                    httpsAgent,
                    headers: HEADERS,
                });
                data = response.data;
                break; // Success — exit retry loop
            } catch (fetchError) {
                if (isRetryableError(fetchError) && attempt < MAX_RETRIES) {
                    const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
                    console.warn(`⚠️  JSON fetch attempt ${attempt} failed for ${key}: ${fetchError.code || fetchError.message}. Retrying in ${delay}ms...`);
                    await new Promise((r) => setTimeout(r, delay));
                } else {
                    throw fetchError; // Non-retryable or final attempt — let outer catch handle it
                }
            }
        }

        if (!data || typeof data !== "object") {
            console.error(`❌ Invalid JSON data from ${url}`);
            return;
        }

        // Process images based on data type
        if (key === "homepage" && data.images) {
            console.log(`📸 Processing homepage images`);
            data.images = await downloadWithConcurrency(data.images, async (image) => {
                const filename = staticFilename(image.id, image.url);
                const relativePath = await downloadImage(image.url, "homepage", filename);

                return { ...image, url: relativePath };
            });
        } else if ((key === "breeds/holland_lop" || key === "breeds/netherland_dwarf") && data.bunnies) {
            console.log(`🐰 Processing breed images with embedded order: ${key}`);
            const breedFolder = key; // Example: breeds/holland_lop

            for (let bunny of data.bunnies) {
                // Process bunny images
                if (bunny.orderedImages && bunny.orderedImages.length > 0) {
                    console.log(`📊 Using orderedImages for bunny ${bunny.id}`);

                    // Sort by order property
                    const sortedImages = [...bunny.orderedImages].sort((a, b) => a.order - b.order);

                    // Process each image in the sorted order
                    const processedImages = await downloadWithConcurrency(sortedImages, async (imageObj, index) => {
                        const order = imageObj.order;
                        const filename = staticFilename(`${bunny.id}-${order}`, imageObj.url);
                        const relativePath = await downloadImage(imageObj.url, breedFolder, filename);

                        return {
                            url: relativePath,
                            order: order
                        };
                    });

                    // Replace the images array with the processed images
                    // Each entry now contains both url and order
                    bunny.images = processedImages;

                    // Remove orderedImages and orderedImageUrls as they're no longer needed
                    delete bunny.orderedImages;
                    delete bunny.orderedImageUrls;
                }
                // Check if we have orderedImageUrls
                else if (bunny.orderedImageUrls && bunny.orderedImageUrls.length > 0) {
                    console.log(`📊 Using orderedImageUrls for bunny ${bunny.id}`);

                    // Sort by order property
                    const sortedImages = [...bunny.orderedImageUrls].sort((a, b) => a.order - b.order);

                    // Process each image in the sorted order
                    const processedImages = await downloadWithConcurrency(sortedImages, async (imageObj, index) => {
                        const order = imageObj.order;
                        const filename = staticFilename(`${bunny.id}-${order}`, imageObj.url);
                        const relativePath = await downloadImage(imageObj.url, breedFolder, filename);

                        return {
                            url: relativePath,
                            order: order
                        };
                    });

                    // Replace the images array with the processed images
                    bunny.images = processedImages;

                    // Remove orderedImageUrls as it's no longer needed
                    delete bunny.orderedImageUrls;
                }
                // Handle legacy data format (just image URLs in array)
                else if (Array.isArray(bunny.images) && typeof bunny.images[0] === 'string') {
                    console.log(`⚠️ Using legacy format for bunny ${bunny.id}, adding order information`);

                    // Process each image and add order based on array index
                    const processedImages = await downloadWithConcurrency(bunny.images, async (imageUrl, index) => {
                        const order = index + 1;
                        const filename = staticFilename(`${bunny.id}-${order}`, imageUrl);
                        const relativePath = await downloadImage(imageUrl, breedFolder, filename);

                        return {
                            url: relativePath,
                            order: order
                        };
                    });

                    // Replace the images array with the processed images
                    bunny.images = processedImages;
                }
                // Handle already processed format (objects with url and order)
                else if (Array.isArray(bunny.images) && typeof bunny.images[0] === 'object' && bunny.images[0].url) {
                    console.log(`📈 Updating already formatted images for bunny ${bunny.id}`);

                    // Sort by order property
                    const sortedImages = [...bunny.images].sort((a, b) => a.order - b.order);

                    // Process each image in the sorted order
                    const processedImages = await downloadWithConcurrency(sortedImages, async (imageObj) => {
                        const order = imageObj.order;
                        const filename = staticFilename(`${bunny.id}-${order}`, imageObj.url);
                        const relativePath = await downloadImage(imageObj.url, breedFolder, filename);

                        return {
                            url: relativePath,
                            order: order
                        };
                    });

                    // Replace the images array with the processed images
                    bunny.images = processedImages;
                }
            }
        } else if (key.startsWith("breeds/") && data.bunnies) {
            // Regular processing for other breeds (if any)
            console.log(`🐰 Processing breed images: ${key}`);
            const breedFolder = key;

            for (let bunny of data.bunnies) {
                if (bunny.images) {
                    bunny.images = await downloadWithConcurrency(bunny.images, async (imageUrl, index) => {
                        const filename = staticFilename(`${bunny.id}-${index + 1}`, imageUrl);
                        return await downloadImage(imageUrl, breedFolder, filename);
                    });
                }
            }
        } else if (key === "gallery" && data.pets) {
            console.log(`🖼️ Processing gallery images`);
            for (let petId in data.pets) {
                let pet = data.pets[petId];
                if (pet.image_url) {
                    const filename = staticFilename(petId, pet.image_url);
                    pet.image_url = await downloadImage(pet.image_url, "gallery", filename);
                }
            }
        } else if (key === "goats" && data.goats) {
            console.log(`🐐 Processing goat images`);
            for (let goat of data.goats) {
                if (goat.image) {
                    const filename = staticFilename(goat.id, goat.image);
                    goat.image = await downloadImage(goat.image, "goats", filename);
                }
            }
        }
        else if (key === "profile" && data.imageUrl) {
            console.log(`📸 Processing profile image...`);

            const profileImageUrl = data.imageUrl;
            const filename = staticFilename("profile", profileImageUrl);

            // Download image and get relative path
            const relativePath = await downloadImage(profileImageUrl, "profile", filename);

            // ✅ Update the JSON structure
            data.imageUrl = relativePath;  // Replace external URL with local path
        }

        // Ensure nested directory structure for breeds
        const jsonFilePath = path.join(DATA_DIR, `${key}.json`);
        await fs.ensureDir(path.dirname(jsonFilePath));

        // Save updated JSON with relative paths
        await fs.writeJson(jsonFilePath, data, { spaces: 2 });
        console.log(`✅ Processed and saved: ${jsonFilePath}`);
    } catch (error) {
        console.error(`❌ Error processing ${url}:`, error.message);
    }
}

/**
 * Main function to clean directories, fetch JSONs, and process images
 */
(async () => {
    await cleanDirectories(); // Clean data before fetching new content

    const entries = Object.entries(jsonUrls);
    for (let i = 0; i < entries.length; i++) {
        const [key, url] = entries[i];
        await processJson(key, url);
        // Pause between JSON endpoints to let Cloudflare edge recover
        if (i < entries.length - 1) {
            await new Promise((r) => setTimeout(r, 1000));
        }
    }

    console.log("🎉 Image download and JSON update complete!");
})();