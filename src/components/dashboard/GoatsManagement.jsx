import { useEffect, useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import SortableGoatCard from "./SortableGoatCard";

const API_BASE = "https://backend.sillybillysilkies.workers.dev";

const GoatsManagement = () => {
    const [goats, setGoats] = useState([]);
    const [initialOrder, setInitialOrder] = useState({ for_sale: [], existing: [] });
    const [orderChanged, setOrderChanged] = useState(false);
    const [sectionFilter, setSectionFilter] = useState("all");
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [savingId, setSavingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const [newGoat, setNewGoat] = useState({
        line1: "",
        line2: "",
        line3: "",
        section: "existing",
        image: "",
        imageFile: null,
    });

    const sensors = useSensors(
        useSensor(MouseSensor),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 150, tolerance: 5 },
        })
    );

    const fetchGoats = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE}/goats/fetch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const data = await response.json();
            if (data.goats && Array.isArray(data.goats)) {
                const sorted = data.goats.sort((a, b) => a.order - b.order);
                setGoats(sorted);
                setInitialOrder({
                    for_sale: sorted.filter(g => g.section === "for_sale").map(g => g.id),
                    existing: sorted.filter(g => g.section === "existing").map(g => g.id),
                });
                setOrderChanged(false);
            } else {
                setGoats([]);
            }
        } catch (error) {
            console.error("Error fetching goats:", error);
            setGoats([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchGoats();
    }, []);

    const checkOrderChanged = (currentGoats) => {
        const currentForSale = currentGoats.filter(g => g.section === "for_sale").map(g => g.id);
        const currentExisting = currentGoats.filter(g => g.section === "existing").map(g => g.id);
        const changed =
            JSON.stringify(currentForSale) !== JSON.stringify(initialOrder.for_sale) ||
            JSON.stringify(currentExisting) !== JSON.stringify(initialOrder.existing);
        setOrderChanged(changed);
    };

    // Toggle edit mode
    const toggleEdit = (id) => {
        setGoats(prev => prev.map(g => g.id === id ? { ...g, isEditing: !g.isEditing } : g));
    };

    // Handle input changes
    const handleChange = (id, field, value) => {
        setGoats(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
    };

    // Handle image upload for existing goat
    const handleImageUpload = (id, event) => {
        const file = event.target.files[0];
        if (file) {
            const imageUrl = URL.createObjectURL(file);
            setGoats(prev => prev.map(g => g.id === id ? { ...g, image: imageUrl, imageFile: file } : g));
        }
    };

    // Handle new goat form changes
    const handleNewGoatChange = (field, value) => {
        setNewGoat({ ...newGoat, [field]: value });
    };

    const handleNewImageUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            const imageUrl = URL.createObjectURL(file);
            setNewGoat({ ...newGoat, image: imageUrl, imageFile: file });
        }
    };

    // Add new goat
    const handleAddGoat = async () => {
        if (!newGoat.line1.trim()) {
            alert("Line 1 is required!");
            return;
        }
        setIsAdding(true);

        const formData = new FormData();
        formData.append("details", JSON.stringify({
            line1: newGoat.line1,
            line2: newGoat.line2,
            line3: newGoat.line3,
            section: newGoat.section,
        }));
        if (newGoat.imageFile) {
            formData.append("file", newGoat.imageFile);
        }

        try {
            const response = await fetch(`${API_BASE}/goats/add`, { method: "POST", body: formData });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            await fetchGoats();
            setNewGoat({ line1: "", line2: "", line3: "", section: "existing", image: "", imageFile: null });
        } catch (error) {
            console.error("Error adding goat:", error);
        } finally {
            setIsAdding(false);
        }
    };

    // Save goat updates
    const handleSaveGoat = async (id) => {
        setSavingId(id);
        const goat = goats.find(g => g.id === id);
        if (!goat) return;

        const formData = new FormData();
        formData.append("id", id);
        formData.append("details", JSON.stringify({
            line1: goat.line1,
            line2: goat.line2,
            line3: goat.line3,
        }));
        if (goat.imageFile) {
            formData.append("file", goat.imageFile);
        }

        try {
            const response = await fetch(`${API_BASE}/goats/update`, { method: "PUT", body: formData });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            await fetchGoats();
        } catch (error) {
            console.error("Error updating goat:", error);
        } finally {
            setSavingId(null);
        }
    };

    // Delete goat
    const handleDeleteGoat = async (id) => {
        setDeletingId(id);
        try {
            const response = await fetch(`${API_BASE}/goats/delete`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (!response.ok) throw new Error(`Failed to delete goat: ${response.statusText}`);
            setGoats(prev => prev.filter(g => g.id !== id));
        } catch (error) {
            console.error("Error deleting goat:", error);
        } finally {
            setDeletingId(null);
        }
    };

    // Move goat to other section
    const handleMoveSection = async (id, targetSection) => {
        try {
            const response = await fetch(`${API_BASE}/goats/moveSection`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, targetSection }),
            });
            if (!response.ok) throw new Error(`Failed to move goat: ${response.statusText}`);
            await fetchGoats();
        } catch (error) {
            console.error("Error moving goat:", error);
        }
    };

    // Drag and drop handler
    const handleDragEnd = (event, section) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setGoats(prevGoats => {
            const sectionGoats = prevGoats.filter(g => g.section === section).sort((a, b) => a.order - b.order);
            const otherGoats = prevGoats.filter(g => g.section !== section);

            const oldIndex = sectionGoats.findIndex(g => g.id === active.id);
            const newIndex = sectionGoats.findIndex(g => g.id === over.id);
            const reordered = arrayMove(sectionGoats, oldIndex, newIndex);

            // Recalculate order sequentially so .sort() preserves the new positions
            const reorderedWithOrder = reordered.map((goat, index) => ({
                ...goat,
                order: index + 1,
            }));

            const allGoats = [...otherGoats, ...reorderedWithOrder];
            checkOrderChanged(allGoats);
            return allGoats;
        });
    };

    // Save order
    const updateOrderInDatabase = async () => {
        setIsLoading(true);
        try {
            const sections = ["for_sale", "existing"];
            for (const section of sections) {
                const sectionGoats = goats
                    .filter(g => g.section === section)
                    .sort((a, b) => a.order - b.order);
                const currentIds = sectionGoats.map(g => g.id);
                const initialIds = initialOrder[section];

                if (JSON.stringify(currentIds) !== JSON.stringify(initialIds)) {
                    const formattedOrder = sectionGoats.map((g, index) => ({
                        id: g.id,
                        order: index + 1,
                    }));

                    const response = await fetch(`${API_BASE}/goats/updateOrder`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ section, orderedIds: formattedOrder }),
                    });
                    if (!response.ok) throw new Error(`Failed to update order for ${section}`);
                }
            }

            setInitialOrder({
                for_sale: goats.filter(g => g.section === "for_sale").map(g => g.id),
                existing: goats.filter(g => g.section === "existing").map(g => g.id),
            });
            setOrderChanged(false);
        } catch (error) {
            console.error("Error updating order:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const forSaleGoats = goats.filter(g => g.section === "for_sale").sort((a, b) => a.order - b.order);
    const existingGoats = goats.filter(g => g.section === "existing").sort((a, b) => a.order - b.order);

    const renderSection = (sectionGoats, section, title) => (
        <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-[#4A3B2D]">{title} ({sectionGoats.length})</h2>
            {sectionGoats.length === 0 ? (
                <p className="text-gray-500 italic">No goats in this section.</p>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, section)}>
                    <SortableContext items={sectionGoats.map(g => g.id)} strategy={verticalListSortingStrategy}>
                        {sectionGoats.map(goat => (
                            <SortableGoatCard
                                key={goat.id}
                                goat={goat}
                                savingId={savingId}
                                deletingId={deletingId}
                                toggleEdit={toggleEdit}
                                handleDeleteGoat={handleDeleteGoat}
                                handleImageUpload={handleImageUpload}
                                handleChange={handleChange}
                                handleSaveGoat={handleSaveGoat}
                                handleMoveSection={handleMoveSection}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );

    return (
        <div className="p-4 bg-gray-100 min-h-screen">
            <div className="flex justify-between items-start flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-semibold mb-4">Goats Management</h1>
                    <p className="mb-6">Total goats: {goats.length} (For Sale: {forSaleGoats.length}, Existing: {existingGoats.length})</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {/* Section filter tabs */}
                    <button
                        className={`px-4 py-2 rounded-md text-sm ${sectionFilter === "all" ? "bg-[#754E1A] text-white" : "bg-white text-[#754E1A] border border-[#754E1A]"}`}
                        onClick={() => setSectionFilter("all")}
                    >
                        All
                    </button>
                    <button
                        className={`px-4 py-2 rounded-md text-sm ${sectionFilter === "for_sale" ? "bg-[#754E1A] text-white" : "bg-white text-[#754E1A] border border-[#754E1A]"}`}
                        onClick={() => setSectionFilter("for_sale")}
                    >
                        For Sale
                    </button>
                    <button
                        className={`px-4 py-2 rounded-md text-sm ${sectionFilter === "existing" ? "bg-[#754E1A] text-white" : "bg-white text-[#754E1A] border border-[#754E1A]"}`}
                        onClick={() => setSectionFilter("existing")}
                    >
                        Existing
                    </button>
                    <button
                        className={`px-4 py-2 rounded-md text-white flex items-center gap-2 text-sm
                            ${orderChanged ? "bg-[#754E1A] hover:bg-[#5f482a]" : "bg-gray-400 cursor-not-allowed"}`}
                        onClick={updateOrderInDatabase}
                        disabled={!orderChanged || isLoading}
                    >
                        {isLoading ? (
                            <>
                                <CgSpinner className="animate-spin mr-2" />
                                Loading...
                            </>
                        ) : (
                            "Save Order"
                        )}
                    </button>
                </div>
            </div>

            {/* Add New Goat Form */}
            <div className="bg-white p-4 md:p-6 rounded-lg shadow mb-6 flex flex-col md:flex-row items-center gap-4 md:gap-6 border-2 border-dashed border-[#4A3B2D] relative">
                {isAdding && (
                    <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center rounded-lg z-10">
                        <CgSpinner className="animate-spin text-green-500 text-4xl" />
                        <span className="ml-2 font-medium">Adding new goat...</span>
                    </div>
                )}

                {/* Image Upload */}
                <label className="w-64 h-64 md:w-64 md:h-64 border-dashed border-2 border-[#4A3B2D] rounded-lg flex items-center justify-center overflow-hidden cursor-pointer">
                    <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleNewImageUpload}
                    />
                    {newGoat.image ? (
                        <img src={newGoat.image} alt="Uploaded" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-gray-400 text-xs md:text-sm">Click to upload</span>
                    )}
                </label>

                {/* Form Fields */}
                <div className="flex-1 w-full md:w-auto">
                    <div className="mb-3">
                        <label className="block text-[#4A3B2D] text-sm font-medium">Line 1 *</label>
                        <input
                            type="text"
                            value={newGoat.line1}
                            onChange={(e) => handleNewGoatChange("line1", e.target.value)}
                            className="w-full text-[#4A3B2D] border border-[#4A3B2D] p-2 rounded"
                            placeholder="e.g. Nigerian Dwarf Buck"
                        />
                    </div>
                    <div className="mb-3">
                        <label className="block text-[#4A3B2D] text-sm font-medium">Line 2</label>
                        <input
                            type="text"
                            value={newGoat.line2}
                            onChange={(e) => handleNewGoatChange("line2", e.target.value)}
                            className="w-full text-[#4A3B2D] border border-[#4A3B2D] p-2 rounded"
                            placeholder="e.g. Purebred"
                        />
                    </div>
                    <div className="mb-3">
                        <label className="block text-[#4A3B2D] text-sm font-medium">Line 3</label>
                        <input
                            type="text"
                            value={newGoat.line3}
                            onChange={(e) => handleNewGoatChange("line3", e.target.value)}
                            className="w-full text-[#4A3B2D] border border-[#4A3B2D] p-2 rounded"
                            placeholder="e.g. Tri-Color"
                        />
                    </div>
                    <div className="mb-3">
                        <label className="block text-[#4A3B2D] text-sm font-medium">Section</label>
                        <select
                            value={newGoat.section}
                            onChange={(e) => handleNewGoatChange("section", e.target.value)}
                            className="w-full text-[#4A3B2D] border border-[#4A3B2D] p-2 rounded"
                        >
                            <option value="existing">Existing Goats</option>
                            <option value="for_sale">Goats for Sale</option>
                        </select>
                    </div>
                    <button
                        className="bg-[#754E1A] hover:bg-[#5f482a] text-white px-6 py-2 rounded cursor-pointer"
                        onClick={handleAddGoat}
                        disabled={isAdding}
                    >
                        Add Goat
                    </button>
                </div>
            </div>

            {/* Loading State */}
            {isLoading && goats.length === 0 ? (
                <div className="flex justify-center items-center py-20">
                    <CgSpinner className="animate-spin text-[#754E1A] text-4xl" />
                    <span className="ml-2 text-[#4A3B2D]">Loading goats...</span>
                </div>
            ) : (
                <>
                    {(sectionFilter === "all" || sectionFilter === "for_sale") &&
                        renderSection(forSaleGoats, "for_sale", "Goats for Sale")}
                    {(sectionFilter === "all" || sectionFilter === "existing") &&
                        renderSection(existingGoats, "existing", "Existing Goats")}
                </>
            )}
        </div>
    );
};

export default GoatsManagement;
