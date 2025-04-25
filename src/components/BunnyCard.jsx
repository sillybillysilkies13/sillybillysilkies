import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import { Pagination, Autoplay } from "swiper/modules";

const BunnyCard = ({ data, index }) => {
    // Sort images by order property if available, otherwise use as-is
    const sortedImages = useMemo(() => {
        // Check if images are objects with url and order properties
        if (data.images && data.images.length > 0 && typeof data.images[0] === 'object' && data.images[0].url) {
            // Sort by order property
            return [...data.images].sort((a, b) => a.order - b.order).map(img => img.url);
        }
        // Use images as-is if they're just strings
        return data.images || [];
    }, [data.images]);

    // Get the main image (first in sorted order)
    const mainImage = sortedImages.length > 0 ? sortedImages[0] : "";

    // Get additional images (all except the first)
    const additionalImages = sortedImages.slice(1);

    return (
        <div className="sm:max-w-5xl sm:mx-auto sm:py-6 sm:px-12">
            {/* Ensure flex-row and alternate layout for odd and even indexes */}
            <div className={`flex flex-col sm:flex-row ${index % 2 === 0 ? "sm:flex-row" : "sm:flex-row-reverse"} ${index % 2 === 0 ? "sm:space-x-12" : "sm:ml-5"} items-center`}>

                {/* Image Section - Carousel on Mobile */}
                <motion.div
                    className="relative w-full sm:w-1/2 flex-shrink-0 sm:hover:scale-150 sm:hover:z-50 transition-transform duration-300">

                    {/* Mobile: Swiper Carousel */}
                    <div className="sm:hidden">
                        <Swiper
                            spaceBetween={10}
                            slidesPerView={1}
                            pagination={{ clickable: true }}
                            autoplay={{ delay: 2000, disableOnInteraction: false }}
                            modules={[Pagination, Autoplay]}
                            className="w-full relative"
                        >
                            {sortedImages.map((img, imgIndex) => (
                                <SwiperSlide key={imgIndex}>
                                    <motion.div className="relative w-full flex justify-center">
                                        {/* Sold Badge */}
                                        {data.status === "sold" && (
                                            <motion.div
                                                whileHover={{ scale: 1.1 }}
                                                transition={{ duration: 0.3 }}
                                                className="absolute top-2 right-5"
                                            >
                                                <img src="/Images/sold_button.svg" className="h-8" alt="" />
                                            </motion.div>
                                        )}

                                        <img
                                            src={img}
                                            alt={`Bunny ${imgIndex + 1}`}
                                            className="w-11/12 h-64 rounded-lg object-cover border"
                                        />
                                    </motion.div>
                                </SwiperSlide>
                            ))}
                        </Swiper>

                        {/* Pagination Below the Image */}
                        <div className="swiper-pagination !static mt-3"></div>
                    </div>

                    {/* Desktop: Static Image with Hover Effect */}
                    <div className="hidden sm:block relative">
                        {data.status === "sold" && (
                            <motion.div
                                whileHover={{ scale: 1.1 }}
                                transition={{ duration: 0.3 }}
                                className="absolute top-5 right-5"
                            >
                                <img src="/Images/sold_button.svg" className="h-12" alt="" />
                            </motion.div>
                        )}
                        <motion.img
                            src={mainImage}
                            alt="Bunny"
                            className="w-full aspect-square rounded-3xl object-cover"
                        />
                    </div>
                </motion.div>


                {/* Text Section */}
                <div style={{ fontFamily: "Futura LT Light, sans-serif" }} className="mt-4 sm:mt-0 sm:w-1/2 text-black flex flex-col text-lg sm:text-2xl space-y-9">
                    <p>Breed: {data.breed}</p>
                    <p>Pedigreed Parents: {data.pedigreedParents}</p>
                    <p>Gender: {data.gender}</p>
                    <p>Color: {data.color}</p>
                    <p>Date of Birth: {data.dob}</p>
                    <p>Take home date: {data.takeHomeDate}</p>
                    <p>Price: ${data.price}</p>
                </div>
            </div>

            {/* Desktop: Additional Images */}
            <div className="hidden sm:grid grid-cols-3 mt-16 gap-16">
                {additionalImages.map((img, imgIndex) => (
                    <motion.div
                        key={imgIndex}
                        className="relative aspect-square h-full"
                        whileHover={{ scale: 1.5, zIndex: 50 }}
                        transition={{ duration: 0.3 }}
                        style={{ position: "relative", zIndex: 1 }}
                    >
                        {/* Sold Badge on Additional Images */}
                        {data.status === "sold" && (
                            <motion.div
                                className="absolute top-3 right-2"
                                whileHover={{ scale: 1.1 }}
                                transition={{ duration: 0.3 }}
                            >
                                <img src="/Images/sold_button.svg" className="h-9" alt="" />
                            </motion.div>
                        )}

                        <motion.img
                            src={img}
                            alt={`Bunny ${imgIndex + 2}`}
                            className="w-full h-full object-cover rounded-3xl"
                        />
                    </motion.div>
                ))}
            </div>

            <div className="flex justify-center my-5 sm:my-0 sm:mt-16 sm:mb-4">
                <hr className="border-t-2 border-yellow-500 w-4/5" />
            </div>
        </div>
    );
};

export default BunnyCard;