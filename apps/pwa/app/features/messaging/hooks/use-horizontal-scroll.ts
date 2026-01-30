import { useEffect, useRef } from "react";

/**
 * A hook that translates vertical scroll events (mouse wheel) into horizontal scroll.
 * This is useful for horizontal scroll areas on desktop where users expect the mouse wheel to work.
 * 
 * @returns A React ref to be attached to the scrollable container.
 */
export function useHorizontalScroll<T extends HTMLElement>() {
    const elementRef = useRef<T>(null);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        const handleWheel = (e: WheelEvent) => {
            // If deltaY is 0, it's already a horizontal scroll event (deltaX)
            if (e.deltaY === 0) return;

            // Prevent standard vertical scroll
            e.preventDefault();

            // Translate deltaY to scrollLeft
            element.scrollTo({
                left: element.scrollLeft + e.deltaY,
                behavior: "auto", // Immediate scrolling for better responsiveness
            });
        };

        element.addEventListener("wheel", handleWheel, { passive: false });

        return () => {
            element.removeEventListener("wheel", handleWheel);
        };
    }, []);

    return elementRef;
}
