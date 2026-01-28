import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CircleArrowLeft, GripVertical, X } from "lucide-react";
import {
    DndContext,
    closestCenter,
    MouseSensor,
    TouchSensor,
    KeyboardSensor,
    useSensor,
    useSensors
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const SortableImage = ({ img, index, onDelete }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: img });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            style={style}
            className="relative w-64 h-64 sm:w-72 sm:h-72 mt-4 rounded-lg overflow-hidden border flex flex-col bg-white"
        >
            <div className="flex items-center justify-between p-1 bg-gray-50 border-b">
                <div className="cursor-grab p-1">
                    <GripVertical className="w-4 h-4 text-gray-500" />
                </div>
                <span className="text-xs text-gray-500">Image {index + 1}</span>
            </div>
            <div className="flex-grow overflow-hidden">
                <img
                    src={img}
                    alt="Preview"
                    className="w-full h-full object-cover"
                />
            </div>
            <button
                onTouchStart={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => onDelete(img)}
                className="absolute top-1 right-1 bg-[#754E1A] text-white rounded-full text-xs p-1 z-10"
            >
                <X className="w-4 h-4 text-white" />
            </button>
        </div>
    );
};

const AddNewBunny = () => {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [bunny, setBunny] = useState({
        breed: "Netherland Dwarf",
        name: "",
        gender: "",
        dob: "",
        takeHomeDate: "",
        price: "",
        status: "available",
        pedigreedParents: "",
        color: "",
        images: [],
    });
    const [orderedImages, setOrderedImages] = useState([]);
    const [orderChanged, setOrderChanged] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const isMounted = useRef(true);

    // Setup dnd-kit sensors - adjusted to match HomePageCarousel
    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 10, // Require 10px movement before drag starts
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 150,
                tolerance: 5,
                distance: 10, // Require 10px movement for touch drag
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    // Handle navigation prompts and cleanup on unmount only
    useEffect(() => {
        isMounted.current = true;

        const handleBeforeUnload = (event) => {
            if (bunny.images.length > 0 && !isSubmitted) {
                event.preventDefault();
                event.returnValue = "You have unsaved images. Do you really want to leave?";
            }
        };

        const handleNavigation = async (event) => {
            const targetLink = event.target.closest("a");

            if (bunny.images.length > 0 && !isSubmitted && targetLink) {
                event.preventDefault();
                const userConfirmed = window.confirm("You have unsaved images. Do you want to save before leaving?");

                if (userConfirmed) {
                    console.log("Saving bunny...");
                    await handleSubmit();
                } else {
                    console.log("Deleting images from R2...");
                    await deleteImagesFromR2(bunny, setBunny);
                    navigate(targetLink.pathname + targetLink.search);
                }
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        document.addEventListener("click", handleNavigation, true);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            document.removeEventListener("click", handleNavigation, true);
            isMounted.current = false;
        };
    }, []);

    // Cleanup effect separated with no dependencies
    useEffect(() => {
        return () => {
            if (bunny.images.length > 0 && !isSubmitted && !isMounted.current) {
                console.log("Cleanup on unmount triggered");
                deleteImagesFromR2(bunny, setBunny).catch((error) => {
                    console.error("Error during cleanup on unmount:", error);
                });
            }
        };
    }, []);

    useEffect(() => {
        if (id && location.state?.bunny) {
            const loadedBunny = location.state.bunny;
            setBunny(loadedBunny);

            // Generate ordered images when loading an existing bunny
            if (loadedBunny.images && loadedBunny.images.length > 0) {
                const newOrderedImages = loadedBunny.images.map((img, index) => ({
                    url: img,
                    order: index + 1
                }));
                setOrderedImages(newOrderedImages);
            }
        }
    }, [id, location.state]);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [currentPage]);

    const handleChange = (e) => {
        setBunny({ ...bunny, [e.target.name]: e.target.value });
    };

    const handleBreedSelection = (selectedBreed) => {
        setBunny({ ...bunny, breed: selectedBreed });
    };

    const handleAddImages = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        setLoading(true);
        const formData = new FormData();
        formData.append("pageType", `breeds/${bunny.breed.toLowerCase().replace(/\s+/g, "_")}`);
        files.forEach((file) => formData.append("files", file));

        try {
            const response = await fetch("https://backend.sillybillysilkies.workers.dev/addImages", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error(`Image upload failed! Status: ${response.status}`);

            const data = await response.json();
            const uploadedUrls = data.uploadedUrls || [];
            console.log("Uploaded URLs:", uploadedUrls);

            // Add new images to bunny state
            const newImages = [...bunny.images, ...uploadedUrls];
            setBunny((prev) => ({
                ...prev,
                images: newImages,
            }));

            // Update ordered images with order numbers
            const newOrderedImages = newImages.map((url, index) => ({
                url: url,
                order: index + 1
            }));
            setOrderedImages(newOrderedImages);
        } catch (error) {
            console.error("Error uploading images:", error);
            alert("Failed to upload images. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Handle drag end for sorting images - updated to match HomePageCarousel style
    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            const oldIndex = bunny.images.indexOf(active.id);
            const newIndex = bunny.images.indexOf(over.id);

            // Reorder images array
            const reorderedImages = arrayMove(bunny.images, oldIndex, newIndex);

            // Check if order actually changed
            const hasOrderChanged = JSON.stringify(reorderedImages) !== JSON.stringify(bunny.images);

            // Update bunny state with new image order
            setBunny((prev) => ({
                ...prev,
                images: reorderedImages,
            }));

            // Update ordered images array with new order numbers
            const newOrderedImages = reorderedImages.map((url, index) => ({
                url: url,
                order: index + 1
            }));

            setOrderedImages(newOrderedImages);
            setOrderChanged(hasOrderChanged);
        }
    };

    const handleSubmit = async () => {
        if (!bunny.breed || !bunny.gender || !bunny.dob || !bunny.takeHomeDate || !bunny.price) {
            alert("Please fill all required fields!");
            return;
        }
        setLoading(true);

        try {
            // Create ordered images array from current images
            const imagesList = bunny.images.map((url, index) => ({
                url: url,
                order: index + 1
            }));

            // Store the images in the correct order
            // This ensures the bunny.images array is sorted by order
            const sortedImages = [...imagesList].sort((a, b) => a.order - b.order).map(img => img.url);

            if (id) {
                const updatedData = {
                    id: id,
                    pageType: `breeds/${bunny.breed.toLowerCase().replace(/\s+/g, "_")}`,
                    breed: bunny.breed,
                    name: bunny.name,
                    gender: bunny.gender,
                    dob: bunny.dob,
                    takeHomeDate: bunny.takeHomeDate,
                    price: bunny.price,
                    status: bunny.status,
                    pedigreedParents: bunny.pedigreedParents,
                    color: bunny.color,
                    images: sortedImages, // Use sorted images
                    orderedImages: imagesList // Keep order metadata
                };

                const response = await fetch("https://backend.sillybillysilkies.workers.dev/update", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updatedData),
                });

                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

                // Update the image order in KV
                await updateImagesOrder(sortedImages, id, `breeds/${bunny.breed.toLowerCase().replace(/\s+/g, "_")}`);

                alert("Bunny updated successfully!");
            } else {
                const details = JSON.stringify({
                    breed: bunny.breed,
                    name: bunny.name,
                    gender: bunny.gender,
                    dob: bunny.dob,
                    takeHomeDate: bunny.takeHomeDate,
                    price: bunny.price,
                    status: bunny.status,
                    pedigreedParents: bunny.pedigreedParents,
                    color: bunny.color,
                    images: sortedImages, // Use sorted images
                    orderedImages: imagesList // Keep order metadata
                });

                const formData = new FormData();
                formData.append("details", details);
                formData.append("pageType", `breeds/${bunny.breed.toLowerCase().replace(/\s+/g, "_")}`);

                bunny.images.forEach((img) => {
                    if (img instanceof File) {
                        formData.append("file", img);
                    }
                });

                const response = await fetch("https://backend.sillybillysilkies.workers.dev/upload", {
                    method: "POST",
                    body: formData,
                });

                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

                const responseData = await response.json();

                // Update the image order in KV with the new bunny ID
                await updateImagesOrder(sortedImages, responseData.id, `breeds/${bunny.breed.toLowerCase().replace(/\s+/g, "_")}`);

                alert("Bunny added successfully!");
            }

            setIsSubmitted(true);
            navigate("/admin/manage-listing");
        } catch (error) {
            console.error("Error submitting data:", error);
            alert("Failed to save bunny. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Function to update image order in KV storage - updated to match HomePageCarousel
    const updateImagesOrder = async (images, bunnyId, pageType) => {
        try {
            // Create array of ordered images with indices
            const orderedImages = images.map((url, index) => ({
                url,
                order: index + 1
            }));

            const response = await fetch("https://backend.sillybillysilkies.workers.dev/updateBunnyImagesOrder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bunnyId,
                    pageType,
                    orderedImages,
                    // Also send the ordered image array as the images array
                    // This ensures that the images are stored in the correct order in the KV
                    images: orderedImages.map(img => img.url)
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to update image order");
            }

            console.log("Image order updated successfully");
            setOrderChanged(false);
        } catch (error) {
            console.error("Error updating image order:", error);
        }
    };

    const handleDeleteImage = async (imageUrl) => {
        setLoading(true);
        try {
            if (id) {
                const bunnyId = id;
                const pageType = `breeds/${bunny.breed.toLowerCase().replace(/\s+/g, "_")}`;
                const imageUrls = [imageUrl];

                const response = await fetch("https://backend.sillybillysilkies.workers.dev/deleteImage", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bunnyId, pageType, imageUrls }),
                });

                if (!response.ok) throw new Error("Failed to delete image");

                // Update bunny state removing the deleted image
                const updatedImages = bunny.images.filter((img) => img !== imageUrl);
                setBunny((prev) => ({
                    ...prev,
                    images: updatedImages,
                }));

                // Update ordered images
                const newOrderedImages = updatedImages.map((url, index) => ({
                    url: url,
                    order: index + 1
                }));
                setOrderedImages(newOrderedImages);
            } else {
                await deleteImagesFromR2(bunny, setBunny, imageUrl);
            }
        } catch (error) {
            console.error("Error deleting image:", error);
            alert("Failed to delete image. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const deleteImagesFromR2 = async (bunny, setBunny, imageUrlToDelete = null) => {
        if (!bunny || !bunny.images || bunny.images.length === 0) return;

        try {
            const pageType = `breeds/${bunny.breed.toLowerCase().replace(/\s+/g, "_")}`;
            const imageUrls = imageUrlToDelete ? [imageUrlToDelete] : bunny.images.filter(img => typeof img === "string");

            if (imageUrls.length === 0) return;

            const response = await fetch("https://backend.sillybillysilkies.workers.dev/deleteImageR2", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pageType, imageUrls }),
            });

            if (!response.ok) throw new Error("Failed to delete images from R2");

            console.log("Images successfully deleted from R2:", imageUrls);

            // Update bunny images
            const updatedImages = bunny.images.filter((img) => !imageUrls.includes(img));
            setBunny((prev) => ({
                ...prev,
                images: updatedImages,
            }));

            // Update ordered images
            const newOrderedImages = updatedImages.map((url, index) => ({
                url: url,
                order: index + 1
            }));
            setOrderedImages(newOrderedImages);
        } catch (error) {
            console.error("Error deleting images from R2:", error);
            throw error;
        }
    };

    const handleCancel = async () => {
        if (bunny.images.length > 0) {
            setLoading(true);
            try {
                await deleteImagesFromR2(bunny, setBunny);
            } catch (error) {
                console.error("Error during cancel cleanup:", error);
                alert("Failed to clean up images.");
                return;
            } finally {
                setLoading(false);
            }
        }

        setBunny({
            breed: "Netherland Dwarf",
            name: "",
            gender: "",
            dob: "",
            takeHomeDate: "",
            price: "",
            status: "available",
            pedigreedParents: "",
            color: "",
            images: [],
        });
        setOrderedImages([]);
    };

    const handleback = () => {
        navigate("/admin/manage-listing");
    };

    // Function to update image order directly when order changes
    const handleUpdateOrder = async () => {
        if (!orderChanged || !id) return;

        setLoading(true);
        try {
            const pageType = `breeds/${bunny.breed.toLowerCase().replace(/\s+/g, "_")}`;
            await updateImagesOrder(bunny.images, id, pageType);
            alert("Image order updated successfully!");
        } catch (error) {
            console.error("Error updating image order:", error);
            alert("Failed to update image order.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-2 sm:p-6 bg-gray-100 min-h-screen">
            {loading && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <span className="animate-spin border-4 border-blue-500 border-t-transparent rounded-full w-12 h-12"></span>
                </div>
            )}
            <div className="flex space-x-3 items-center mb-6">
                {id && <span className="cursor-pointer" onClick={handleback}><CircleArrowLeft strokeWidth={2.5} size={25} /></span>}
                <h1 className="text-center text-[#754E1A] sm:text-left text-2xl font-semibold">
                    {id ? "Edit Bunny" : "Add New Bunny"}
                </h1>
            </div>
            <div className="bg-white text-[#4A3B2D] p-6 rounded-lg shadow">
                <h2 className="text-lg text-[#754E1A] font-semibold mb-4">Select Breed</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div
                        className={`border border-[#4A3B2D] rounded-lg p-6 flex items-center justify-center h-24 cursor-pointer ${bunny.breed === "Holland Lop" ? "bg-blue-200 border-blue-500" : "bg-white"}`}
                        onClick={() => handleBreedSelection("Holland Lop")}
                    >
                        <p className="text-[#4A3B2D] font-medium">Holland Lop</p>
                    </div>
                    <div
                        className={`border rounded-lg p-6 flex items-center justify-center h-24 cursor-pointer ${bunny.breed === "Netherland Dwarf" ? "bg-blue-200 border-blue-500" : "bg-white"}`}
                        onClick={() => handleBreedSelection("Netherland Dwarf")}
                    >
                        <p className="text-[#4A3B2D] font-medium">Netherland Dwarf</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[#4A3B2D]">Date of Birth</label>
                        <input
                            type="text"
                            name="dob"
                            value={bunny.dob}
                            placeholder="Enter date of birth"
                            className="w-full border placeholder:text-[#4A3B2D] border-[#4A3B2D] p-2 rounded"
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="block text-[#4A3B2D]">Take Home Date</label>
                        <input
                            type="text"
                            name="takeHomeDate"
                            value={bunny.takeHomeDate}
                            placeholder="Enter take-home date"
                            className="w-full border placeholder:text-[#4A3B2D] border-[#4A3B2D] p-2 rounded"
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="block text-[#4A3B2D]">Price</label>
                        <input
                            type="number"
                            name="price"
                            value={bunny.price}
                            placeholder="$"
                            className="w-full border border-[#4A3B2D] p-2 rounded"
                            onChange={handleChange}
                        />
                    </div>

                    {/*
                      Status field removed from UI as per requirements.
                      Backend and data remain compatible: if status is missing, treat as 'available'.
                    */}
                    <div>
                        <label className="block text-[#4A3B2D]">Pedigreed Parents</label>
                        <select
                            name="pedigreedParents"
                            value={bunny.pedigreedParents || "Pedigreed Parents"}
                            className="w-full border border-[#4A3B2D] p-2 rounded"
                            onChange={handleChange}
                        >
                            {/* Dropdown options as required. Old free-text values are preserved for edit mode. */}
                            {/* If editing and value is not in the list, show it as a disabled option for backward compatibility. */}
                            {(
                                [
                                    "Pedigreed Parents",
                                    "Pedigreed Sire",
                                    "Pedigreed Dam",
                                    "Not Pedigreed"
                                ].includes(bunny.pedigreedParents)
                                    ? null
                                    : (
                                        <option value={bunny.pedigreedParents} disabled>
                                            {bunny.pedigreedParents}
                                        </option>
                                    )
                            )}
                            <option value="Pedigreed Parents">Pedigreed Parents</option>
                            <option value="Pedigreed Sire">Pedigreed Sire</option>
                            <option value="Pedigreed Dam">Pedigreed Dam</option>
                            <option value="Not Pedigreed">Not Pedigreed</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[#4A3B2D]">Color</label>
                        <input
                            type="text"
                            name="color"
                            value={bunny.color}
                            placeholder="Enter bunny color"
                            className="w-full border placeholder:text-[#4A3B2D] border-[#4A3B2D] p-2 rounded"
                            onChange={handleChange}
                        />
                    </div>
                    <div>
                        <label className="block text-[#4A3B2D]">Gender</label>
                        <div className="flex gap-4 mt-2">
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="gender"
                                    value="Male"
                                    checked={bunny.gender === "Male"}
                                    onChange={handleChange}
                                />
                                <span className="ml-2">Male</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="gender"
                                    value="Female"
                                    checked={bunny.gender === "Female"}
                                    onChange={handleChange}
                                />
                                <span className="ml-2">Female</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="mt-6 border-dashed border-2 border-[#4A3B2D] rounded-lg p-6 text-center bg-gray-50">
                    <p className="text-[#4A3B2D]">Upload Bunny Images</p>
                    <p className="text-xs text-[#4A3B2D] mb-2">PNG, JPG, GIF up to 10MB</p>

                    <div className="flex justify-center space-x-2">
                        <label className="cursor-pointer bg-[#754E1A] text-white px-4 py-2 rounded-md hover:bg-[#5f482a]">
                            Select Images
                            <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddImages} disabled={loading} />
                        </label>

                        {orderChanged && id && (
                            <button
                                onClick={handleUpdateOrder}
                                disabled={loading}
                                className={`px-4 py-2 rounded-md text-white text-sm 
                                    ${!loading ? "bg-[#754E1A] hover:bg-[#5f482a]" : "bg-gray-400 cursor-not-allowed"}`}
                            >
                                Update Order
                            </button>
                        )}
                    </div>

                    {bunny.images.length > 0 ? (
                        <div className="mt-4">
                            <p className="text-sm text-[#4A3B2D] mb-2">Drag images to reorder them</p>
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={bunny.images}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {bunny.images.map((img, index) => (
                                            <SortableImage
                                                key={img}
                                                img={img}
                                                index={index}
                                                onDelete={handleDeleteImage}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        </div>
                    ) : (
                        <p className="mt-4 text-[#4A3B2D] italic">No images uploaded</p>
                    )}
                </div>

                <div className="mt-6 flex space-x-1 justify-end">
                    {!id && (
                        <button
                            onClick={handleCancel}
                            className="text-[#754E1A] cursor-pointer bg-white px-4 py-2 rounded border border-[#4A3B2D] flex items-center"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={handleSubmit}
                        className="bg-[#754E1A] cursor-pointer text-white px-4 py-2 rounded hover:bg-[#5f482a] flex items-center"
                        disabled={loading}
                    >
                        Save Bunny
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddNewBunny;