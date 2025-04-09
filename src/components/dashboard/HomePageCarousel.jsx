import { useState, useEffect } from "react";
import { X } from "lucide-react";
import {
    DndContext,
    closestCenter,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
    arrayMove,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const API_URL = "https://backend.sillybillysilkies.workers.dev/fetch";
const UPLOAD_URL = "https://backend.sillybillysilkies.workers.dev/HomepageUpload";
const DELETE_URL = "https://backend.sillybillysilkies.workers.dev/HomepageDelete";
const UPDATE_URL = "https://backend.sillybillysilkies.workers.dev/updateOrder";
const PAGE_TYPE = "homepage";

const HomePageCarousel = () => {
    const [images, setImages] = useState([]);
    const [orderedImages, setOrderedImages] = useState([]);
    const [orderChanged, setOrderChanged] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [loading, isLoading] = useState(false);

    // Adjust sensors to require a minimum distance before dragging
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
        })
    );

    const SortableImage = ({ img }) => {
        const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: img.id });
        const [status, setStatus] = useState(img.status || "available");

        const StatusDropdown = ({ status, onChange }) => {
            const [open, setOpen] = useState(false);

            const toggle = (e) => {
                e.stopPropagation(); // Prevent drag initiation
                setOpen((prev) => !prev);
            };

            const handleSelect = (value) => {
                setOpen(false);
                onChange(value);
            };

            return (
                <div className="absolute top-2 left-2 z-10" onMouseDown={(e) => e.stopPropagation()}>
                    <div className="relative inline-block">
                        <button
                            onClick={toggle}
                            onMouseDown={(e) => e.stopPropagation()} // Prevent drag on button mousedown
                            className={`text-xs font-medium pr-6 pl-2 py-1 rounded-md shadow-sm cursor-pointer transition-colors duration-200 flex items-center gap-1
                                ${status === "available" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                            <svg className="w-4 h-4 relative left-5 flex justify-end" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.314l3.71-4.08a.75.75 0 111.1 1.02l-4.25 4.68a.75.75 0 01-1.1 0l-4.25-4.68a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                            </svg>
                        </button>

                        {open && (
                            <div className="absolute mt-1 w-full rounded-md shadow bg-white text-gray-800 text-sm z-50 border">
                                <div
                                    className="px-2 py-1 bg-green-500 text-white hover:bg-green-600 cursor-pointer rounded-t"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelect("available");
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()} // Prevent drag on option
                                >
                                    Available
                                </div>
                                <div
                                    className="px-2 py-1 bg-red-500 text-white hover:bg-red-600 cursor-pointer rounded-b"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelect("sold");
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()} // Prevent drag on option
                                >
                                    Sold
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        };

        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
        };

        const handleStatusChange = async (newStatus) => {
            setStatus(newStatus);

            try {
                const response = await fetch(UPDATE_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: img.id,
                        pageType: PAGE_TYPE,
                        status: newStatus,
                    }),
                });

                if (!response.ok) throw new Error("Failed to update status");

                setImages((prev) =>
                    prev.map((item) =>
                        item.id === img.id ? { ...item, status: newStatus } : item
                    )
                );
            } catch (err) {
                console.error("Status update error:", err);
            }
        };

        return (
            <div
                ref={setNodeRef}
                {...attributes}
                {...listeners}
                style={style}
                className="relative mt-4 w-64 sm:w-48 md:w-56 lg:w-64 lg:h-64 border border-[#4A3B2D] bg-white rounded-lg shadow"
            >
                <img src={img.url} alt="Carousel" className="h-full w-full rounded-lg" />
                <StatusDropdown status={status} onChange={handleStatusChange} />
                <button
                    onTouchStart={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => handleDeleteImage(img.id)}
                    className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 bg-[#754E1A] text-white rounded-full w-7 h-7 flex items-center justify-center shadow"
                    disabled={deleting === img.id}
                >
                    {deleting === img.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <X className="w-4 h-4 text-white" />
                    )}
                </button>
            </div>
        );
    };

    useEffect(() => {
        const fetchImages = async () => {
            setFetching(true);
            try {
                const response = await fetch(API_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pageType: PAGE_TYPE }),
                });

                if (!response.ok) throw new Error("Failed to fetch images");

                const data = await response.json();
                const allImages = data.images
                    .map((image) => ({
                        id: image.id,
                        url: image.url,
                        order: image.order,
                        status: image.status || "available",
                    }))
                    .sort((a, b) => a.order - b.order);

                setImages(allImages);
            } catch (error) {
                console.error("Error fetching images:", error);
            } finally {
                setFetching(false);
            }
        };

        fetchImages();
    }, []);

    const handleImageChange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const formData = new FormData();
        formData.append("pageType", PAGE_TYPE);
        const validTypes = ["image/jpeg", "image/png", "image/webp"];
        files.forEach((file) => {
            if (validTypes.includes(file.type)) {
                formData.append("file", file);
            }
        });

        setUploading(true);
        try {
            const response = await fetch(UPLOAD_URL, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error("Upload failed");

            const result = await response.json();
            const newImages = result.images.map((img) => ({
                id: img.id,
                url: img.url,
                status: img.status || "available",
            }));

            setImages((prev) => [...prev, ...newImages]);
        } catch (err) {
            console.error("Error uploading:", err);
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteImage = async (imageId) => {
        setDeleting(imageId);
        try {
            const response = await fetch(DELETE_URL, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: imageId, pageType: PAGE_TYPE }),
            });

            if (!response.ok) throw new Error("Failed to delete");

            setImages((prev) => prev.filter((img) => img.id !== imageId));
        } catch (err) {
            console.error("Delete error:", err);
        } finally {
            setDeleting(null);
        }
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            const oldIndex = images.findIndex((img) => img.id === active.id);
            const newIndex = images.findIndex((img) => img.id === over.id);
            const reorderedImages = arrayMove(images, oldIndex, newIndex);
            const hasOrderChanged = JSON.stringify(reorderedImages.map(i => i.id)) !== JSON.stringify(images.map(i => i.id));
            setImages(reorderedImages);
            setOrderChanged(hasOrderChanged);
            const newOrder = reorderedImages.map((img, index) => ({
                id: img.id,
                order: index + 1,
            }));
            setOrderedImages(newOrder);
        }
    };

    const handleOrderChange = async () => {
        if (orderedImages.length === 0) return;
        isLoading(true);
        try {
            const response = await fetch(UPDATE_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(orderedImages),
            });

            if (!response.ok) throw new Error("Failed to update order");
        } catch (err) {
            console.error("Error updating order:", err);
        } finally {
            isLoading(false);
            setOrderChanged(false);
        }
    };

    return (
        <div className="p-4 md:p-6 bg-gray-100 min-h-screen">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-center mb-4">
                    <h1 className="text-2xl font-semibold text-[#754E1A]">Home Page Carousel</h1>
                    <div className="flex space-x-2">
                        <button
                            onClick={handleOrderChange}
                            disabled={!orderChanged || loading}
                            className={`px-4 py-2 rounded-md text-white text-sm md:text-base flex items-center gap-2
                                ${orderChanged && !loading ? "bg-[#754E1A] hover:bg-[#5f482a]" : "bg-gray-400 cursor-not-allowed"}`}
                        >
                            {loading ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    Changing...
                                </>
                            ) : (
                                "Change Order"
                            )}
                        </button>

                        <label className={`cursor-pointer ${uploading ? "bg-gray-400" : "bg-[#754E1A]"} ${uploading ? "" : "hover:bg-[#5f482a]"} text-white px-4 py-2 rounded-md text-sm md:text-base flex items-center gap-2`}>
                            {uploading && <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4"></span>}
                            {uploading ? "Uploading..." : "Upload Images"}
                            <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} disabled={uploading} />
                        </label>
                    </div>
                </div>

                {fetching ? (
                    <div className="flex justify-center items-center w-full h-32">
                        <div className="animate-spin border-4 border-gray-300 border-t-blue-500 rounded-full w-10 h-10"></div>
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={images.map((img) => img.id)} strategy={verticalListSortingStrategy}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 justify-items-center">
                                {images.length === 0 ? (
                                    <p className="text-gray-500 italic text-left w-full">No images available</p>
                                ) : (
                                    images.map((img) => (
                                        <SortableImage key={img.id} img={img} />
                                    ))
                                )}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>
        </div>
    );
};

export default HomePageCarousel;