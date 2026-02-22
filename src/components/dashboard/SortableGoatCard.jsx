import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CgSpinner } from "react-icons/cg";
import { Edit, Trash2, Save, SquareX, ArrowRightLeft, GripVertical } from "lucide-react";

const SortableGoatCard = ({ goat, savingId, deletingId, toggleEdit, handleDeleteGoat, handleImageUpload, handleChange, handleSaveGoat, handleMoveSection }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: goat.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const otherSection = goat.section === "for_sale" ? "existing" : "for_sale";
    const otherSectionLabel = goat.section === "for_sale" ? "Existing Goats" : "Goats for Sale";

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="bg-white py-7 sm:py-8 sm:px-8 rounded-lg shadow mb-6 flex flex-col md:flex-row items-center gap-4 relative"
        >
            {/* Drag Handle */}
            <div {...attributes} {...listeners} className="absolute left-2 top-2 cursor-grab p-2 rounded hover:bg-gray-200">
                <GripVertical size={20} className="text-gray-500" />
            </div>

            {/* Show spinner overlay when saving or deleting */}
            {(savingId === goat.id || deletingId === goat.id) && (
                <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center rounded-lg z-10">
                    <CgSpinner className="animate-spin text-blue-500 text-4xl" />
                    <span className="ml-2 font-medium">
                        {savingId === goat.id ? "Saving..." : "Deleting..."}
                    </span>
                </div>
            )}

            {/* Icons for Edit, Save, Delete, Move */}
            <div className="sm:absolute top-3 right-2 sm:top-3 sm:right-8 flex gap-3 flex-wrap">
                {goat.isEditing ? (
                    <>
                        <button
                            className="border border-[#4A3B2D] text-[#4A3B2D] rounded-sm px-3 py-1 flex items-center cursor-pointer"
                            onClick={() => handleSaveGoat(goat.id)}
                        >
                            <Save size={16} className="mr-1" />
                            Save
                        </button>
                        <button
                            className="border border-[#4A3B2D] text-[#4A3B2D] rounded-sm px-3 py-1 flex items-center cursor-pointer"
                            onClick={() => toggleEdit(goat.id)}
                        >
                            <SquareX size={16} className="mr-1" />
                            Cancel
                        </button>
                    </>
                ) : (
                    <div className="flex justify-center gap-2 flex-wrap">
                        <button
                            className="border border-[#4A3B2D] text-[#4A3B2D] rounded-sm px-3 py-1 flex items-center cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleEdit(goat.id);
                            }}
                        >
                            <Edit size={16} className="mr-1" /> Edit
                        </button>
                        <button
                            className="border border-[#4A3B2D] text-[#4A3B2D] rounded-sm px-3 py-1 flex items-center cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteGoat(goat.id);
                            }}
                        >
                            <Trash2 strokeWidth={2.5} size={16} className="mr-1" />
                            Delete
                        </button>
                        <button
                            className="border border-[#4A3B2D] text-[#4A3B2D] rounded-sm px-3 py-1 flex items-center cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleMoveSection(goat.id, otherSection);
                            }}
                        >
                            <ArrowRightLeft size={16} className="mr-1" />
                            Move to {otherSectionLabel}
                        </button>
                    </div>
                )}
            </div>

            {/* Image */}
            <div className="w-72 h-72 sm:w-64 sm:h-64 border-2 border-[#4A3B2D] rounded-lg flex items-center justify-center overflow-hidden">
                {goat.image ? (
                    <img src={goat.image} alt="Goat" className="w-full h-full object-cover" />
                ) : (
                    <span className="text-gray-400 text-sm">No image</span>
                )}
                {goat.isEditing && (
                    <input
                        type="file"
                        accept="image/*"
                        className="absolute opacity-0 w-72 h-72 sm:w-64 sm:h-64 cursor-pointer"
                        onChange={(e) => handleImageUpload(goat.id, e)}
                    />
                )}
            </div>

            {/* Form Inputs */}
            <div className="flex-1 w-full md:w-auto">
                <div className="mb-4">
                    <label className="block text-[#4A3B2D] text-sm font-medium">Line 1</label>
                    <input
                        type="text"
                        value={goat.line1 || ""}
                        onChange={(e) => handleChange(goat.id, "line1", e.target.value)}
                        className="w-full text-[#4A3B2D] border border-[#4A3B2D] p-2 rounded"
                        disabled={!goat.isEditing}
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-[#4A3B2D] text-sm font-medium">Line 2</label>
                    <input
                        type="text"
                        value={goat.line2 || ""}
                        onChange={(e) => handleChange(goat.id, "line2", e.target.value)}
                        className="w-full text-[#4A3B2D] border border-[#4A3B2D] p-2 rounded"
                        disabled={!goat.isEditing}
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-[#4A3B2D] text-sm font-medium">Line 3</label>
                    <input
                        type="text"
                        value={goat.line3 || ""}
                        onChange={(e) => handleChange(goat.id, "line3", e.target.value)}
                        className="w-full text-[#4A3B2D] border border-[#4A3B2D] p-2 rounded"
                        disabled={!goat.isEditing}
                    />
                </div>
                <div className="mb-2">
                    <span className="inline-block text-xs font-semibold px-2 py-1 rounded bg-[#E0BE9A] text-[#4A3B2D]">
                        {goat.section === "for_sale" ? "For Sale" : "Existing Goats"}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default SortableGoatCard;
