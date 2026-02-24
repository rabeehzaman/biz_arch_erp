import React, { useEffect, useRef } from "react";

export function useEnterToTab<T extends HTMLElement = HTMLFormElement>() {
    const containerRef = useRef<T>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleKeyDown = (e: Event) => {
            const keyboardEvent = e as KeyboardEvent;
            if (keyboardEvent.key === "Enter" && !keyboardEvent.ctrlKey && !keyboardEvent.metaKey && !keyboardEvent.altKey && !keyboardEvent.shiftKey) {
                const activeElement = document.activeElement as HTMLElement;

                // Ignore if focus is not within our container
                if (!activeElement || !container.contains(activeElement)) {
                    return;
                }

                // We only want to map Enter to Tab for basic inputs and selects.
                // If it's a BUTTON (like a submit button, or a Combobox trigger), we let Enter do its default (click/open).
                const tagName = activeElement.tagName.toUpperCase();
                if (tagName === "TEXTAREA" || tagName === "BUTTON" || tagName === "A") {
                    return;
                }

                e.preventDefault(); // Prevent form submission

                // Find all focusable fields that we'd want to tab to
                const focusableElements = container.querySelectorAll(
                    'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button[role="combobox"]:not([disabled]), button[type="submit"]:not([disabled])'
                );

                const focusable = Array.from(focusableElements) as HTMLElement[];
                const index = focusable.indexOf(activeElement);

                if (index > -1 && index < focusable.length - 1) {
                    focusable[index + 1].focus();
                    e.stopPropagation(); // Prevent this same exact keydown from bubbling to window and triggering Combobox Enter handlers
                }
            }
        };

        container.addEventListener("keydown", handleKeyDown);
        return () => container.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Create a helper to programmatically focus the NEXT logical element after a specific element
    const focusNextFocusable = (currentElement: HTMLElement | React.RefObject<HTMLElement | null> | null) => {
        const container = containerRef.current;
        if (!container || !currentElement) return;

        // Extract the actual DOM node if a ref was passed
        let targetElement: HTMLElement;
        if (typeof currentElement === 'object' && currentElement !== null && 'current' in currentElement) {
            if (!currentElement.current) return;
            targetElement = currentElement.current;
        } else if (currentElement instanceof HTMLElement) {
            targetElement = currentElement;
        } else {
            return; // currentElement is null or an unexpected type
        }

        const focusableElements = container.querySelectorAll(
            'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button[role="combobox"]:not([disabled]), button[type="submit"]:not([disabled])'
        );

        const focusable = Array.from(focusableElements) as HTMLElement[];
        const index = focusable.indexOf(targetElement);

        if (index > -1 && index < focusable.length - 1) {
            focusable[index + 1].focus();
        }
    };

    return { containerRef, focusNextFocusable };
}
