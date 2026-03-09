import React from "react";

const GoatCard = ({ data }) => {
    return (
        <div className="relative w-full mx-auto sm:p-4 rounded-lg text-center flex flex-col">
            {/* Image Section */}
            <div className="border-4 p-1 border-white rounded-lg shadow-2xl overflow-hidden relative">
                <img
                    src={data.image}
                    alt="Goat"
                    className="w-full h-auto block"
                />
            </div>
            {/* Text Box Over Image */}
            <div
                style={{ fontFamily: "Futura LT Book" }}
                className="bg-[#E0BE9A] w-full sm:w-8/12 mx-auto mt-2 sm:mt-0 sm:relative sm:bottom-6 bg-opacity-75 text-[#404040] text-lg sm:text-xl font-thin p-3 shadow-md">
                {data.line1 && <p className="font-thin">{data.line1}</p>}
                {data.line2 && <p>{data.line2}</p>}
                {data.line3 && <p>{data.line3}</p>}
            </div>
        </div>
    );
};

export default GoatCard;
