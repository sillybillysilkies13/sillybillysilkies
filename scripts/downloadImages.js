import fs from "fs-extra";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define storage locations inside `public/`
const PUBLIC_DIR = path.join(__dirname, "../public");
const STATIC_IMAGES_DIR = path.join(PUBLIC_DIR, "static-images");
const DATA_DIR = path.join(PUBLIC_DIR, "data");

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
    "profile": "https://backend.sillybillysilkies.workers.dev/GetProfilePic",
};

/**
 * Downloads an image and saves it in `public/static-images/` under the correct subdirectory
 */
async function downloadImage(url, folder, filename) {
    try {
        const saveDir = path.join(STATIC_IMAGES_DIR, folder);
        await fs.ensureDir(saveDir);

        const savePath = path.join(saveDir, filename);
        const relativePath = `/static-images/${folder}/${filename}`; // Web-friendly path

        console.log(`⬇️ Downloading: ${url}`);
        const response = await axios({ url, responseType: "arraybuffer" });

        await fs.writeFile(savePath, response.data);
        console.log(`✅ Saved: ${relativePath}`);
        return relativePath;
    } catch (error) {
        console.error(`❌ Failed to download ${url}:`, error.message);
        return url; // Return original URL if download fails
    }
}

/**
 * Fetch JSON from Cloudflare KV and process images
 */
async function processJson(key, url) {
    try {
        console.log(`🔄 Fetching JSON from: ${url}`);
        const response = await axios.get(url);
        const data = response.data;

        if (!data || typeof data !== "object") {
            console.error(`❌ Invalid JSON data from ${url}`);
            return;
        }

        // Process images based on data type
        if (key === "homepage" && data.images) {
            console.log(`📸 Processing homepage images`);
            data.images = await Promise.all(
                data.images.map(async (image) => {
                    const ext = path.extname(image.url);
                    const filename = `${image.id}${ext}`;
                    const relativePath = await downloadImage(image.url, "homepage", filename);

                    return { ...image, url: relativePath };
                })
            );
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
                    const processedImages = await Promise.all(
                        sortedImages.map(async (imageObj, index) => {
                            const ext = path.extname(imageObj.url);
                            // Format the filename to include order
                            const order = imageObj.order;
                            const filename = `${bunny.id}-${order}${ext}`;
                            const relativePath = await downloadImage(imageObj.url, breedFolder, filename);

                            // Return an object with both url and order directly in the images array
                            return {
                                url: relativePath,
                                order: order
                            };
                        })
                    );

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
                    const processedImages = await Promise.all(
                        sortedImages.map(async (imageObj, index) => {
                            const ext = path.extname(imageObj.url);
                            // Format the filename to include order
                            const order = imageObj.order;
                            const filename = `${bunny.id}-${order}${ext}`;
                            const relativePath = await downloadImage(imageObj.url, breedFolder, filename);

                            // Return an object with both url and order directly in the images array
                            return {
                                url: relativePath,
                                order: order
                            };
                        })
                    );

                    // Replace the images array with the processed images
                    bunny.images = processedImages;

                    // Remove orderedImageUrls as it's no longer needed
                    delete bunny.orderedImageUrls;
                }
                // Handle legacy data format (just image URLs in array)
                else if (Array.isArray(bunny.images) && typeof bunny.images[0] === 'string') {
                    console.log(`⚠️ Using legacy format for bunny ${bunny.id}, adding order information`);

                    // Process each image and add order based on array index
                    const processedImages = await Promise.all(
                        bunny.images.map(async (imageUrl, index) => {
                            const ext = path.extname(imageUrl);
                            const order = index + 1;
                            const filename = `${bunny.id}-${order}${ext}`;
                            const relativePath = await downloadImage(imageUrl, breedFolder, filename);

                            // Return an object with both url and order
                            return {
                                url: relativePath,
                                order: order
                            };
                        })
                    );

                    // Replace the images array with the processed images
                    bunny.images = processedImages;
                }
                // Handle already processed format (objects with url and order)
                else if (Array.isArray(bunny.images) && typeof bunny.images[0] === 'object' && bunny.images[0].url) {
                    console.log(`📈 Updating already formatted images for bunny ${bunny.id}`);

                    // Sort by order property
                    const sortedImages = [...bunny.images].sort((a, b) => a.order - b.order);

                    // Process each image in the sorted order
                    const processedImages = await Promise.all(
                        sortedImages.map(async (imageObj) => {
                            const ext = path.extname(imageObj.url);
                            const order = imageObj.order;
                            const filename = `${bunny.id}-${order}${ext}`;
                            const relativePath = await downloadImage(imageObj.url, breedFolder, filename);

                            // Return an object with both url and order
                            return {
                                url: relativePath,
                                order: order
                            };
                        })
                    );

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
                    bunny.images = await Promise.all(
                        bunny.images.map(async (imageUrl, index) => {
                            const ext = path.extname(imageUrl);
                            const filename = `${bunny.id}-${index + 1}${ext}`;
                            return await downloadImage(imageUrl, breedFolder, filename);
                        })
                    );
                }
            }
        } else if (key === "gallery" && data.pets) {
            console.log(`🖼️ Processing gallery images`);
            for (let petId in data.pets) {
                let pet = data.pets[petId];
                if (pet.image_url) {
                    const ext = path.extname(pet.image_url);
                    const filename = `${petId}${ext}`;
                    pet.image_url = await downloadImage(pet.image_url, "gallery", filename);
                }
            }
        }
        else if (key === "profile" && data.imageUrl) {
            console.log(`📸 Processing profile image...`);

            const profileImageUrl = data.imageUrl;
            const ext = path.extname(profileImageUrl);
            const filename = `profile${ext}`; // Standard filename

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

    for (const [key, url] of Object.entries(jsonUrls)) {
        await processJson(key, url);
    }

    console.log("🎉 Image download and JSON update complete!");
})();