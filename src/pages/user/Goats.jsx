import React, { useEffect, useState } from "react";
import GoatCard from "../../components/GoatCard";

function Goats() {
    const [goats, setGoats] = useState([]);

    useEffect(() => {
        fetch("/data/goats.json")
            .then(res => res.json())
            .then(data => {
                if (data.goats && Array.isArray(data.goats)) {
                    setGoats(data.goats);
                }
            })
            .catch(err => console.error("Error fetching goats:", err));
    }, []);

    const forSaleGoats = goats
        .filter(g => g.section === "for_sale")
        .sort((a, b) => a.order - b.order);

    const existingGoats = goats
        .filter(g => g.section === "existing")
        .sort((a, b) => a.order - b.order);

    return (
        <>
            <div className="bg-[#FFF8F1]">
                <div
                    className="flex flex-col items-center w-full lg:h-[60vh] bg-cover bg-center justify-end text-white text-3xl"
                    style={{ backgroundImage: "url('/Images/goatBG.png')" }}
                >
                    <h2 style={{ fontFamily: "Cookie, cursive" }} className="text-3xl sm:text-5xl max-w-4xl leading-relaxed text-center mt-4 sm:mb-0 text-[#404040]">
                        Here are some of our adult Silky Fainting Goats & Nigerian Dwarf Goats
                    </h2>
                    <p style={{ fontFamily: "Futura LT W01 Medium" }} className="text-center text-base sm:text-xl text-black mb-2">
                        ** Looking for some kids to add to your farm, Please e-mail us to find out who are available **
                    </p>
                </div>
                <div
                    className="py-4 px-4 sm:py-10 sm:px-6 md:max-w-6xl lg:max-w-8/12 mx-auto">
                    <h2
                        style={{ fontFamily: "Inter" }}
                        className="text-2xl font-semibold tracking-[0.5rem] text-[#A2672D] text-center">
                        MINIATURE SILKY FAINTING GOATS
                    </h2>
                    <div
                        style={{ fontFamily: "Open Sans" }}
                    >
                        <p className="mt-8 lg:text-lg  text-[#404040] text-left">
                            Miniature Silky Fainting Goats are a breed of goats that originated between 1990-2000. They are a perfect cross between the Long coated Nigerian Dwarf goats and Tennessee Fainting Goat.
                            These goats will steal your heart with their pint-sized stature, carefree wispy bangs, and long and lustrous velvety hair that hangs straight from the body.
                        </p>
                        <p className="mt-4 lg:text-lg  text-[#404040] text-left">
                            Yes, these goats have short lived fainting episodes when startled. There is no pain involved. They bounce back to normal within a matter of seconds.
                            This a condition known as Myotonia Congenita, a genetic mutation (a permanent alteration in the DNA) where muscle fibers stiffen momentarily, resulting in some goats toppling over. Older animals seem to adapt, sensing an oncoming episode by balancing themselves with outstretched legs, preventing a fall.
                        </p>
                        <p className="mt-4 lg:text-lg text-[#404040] text-left">
                            Mini Silky Fainting goats are a breed to consider. They're a complete package — stunning looks and the ability to connect with humans in a deep and meaningful way.
                            They are truly a joy to be around!
                        </p>
                    </div>
                </div>

                {forSaleGoats.length > 0 && (
                    <div className="">
                        <h2
                            style={{ fontFamily: "Inter" }}
                            className="text-2xl font-semibold tracking-[0.3rem] text-[#A2672D] text-center mb-4">
                            GOATS FOR SALE
                        </h2>
                        <div className="px-3 sm:px-6 sm:pb-6 md:max-w-6xl lg:max-w-8/12 mx-auto grid grid-col-1 space-y-4 sm:grid-cols-2">
                            {forSaleGoats.map((goat) => (
                                <GoatCard key={goat.id} data={goat} />
                            ))}
                        </div>
                    </div>
                )}

                {existingGoats.length > 0 && (
                    <div className="">
                        <h2
                            style={{ fontFamily: "Inter" }}
                            className="text-2xl font-semibold tracking-[0.3rem] text-[#A2672D] text-center mb-4">
                            EXISTING GOATS
                        </h2>
                        <div className="px-3 sm:px-6 sm:pb-6 md:max-w-6xl lg:max-w-8/12 mx-auto grid grid-col-1 space-y-4 sm:grid-cols-2">
                            {existingGoats.map((goat) => (
                                <GoatCard key={goat.id} data={goat} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

export default Goats;