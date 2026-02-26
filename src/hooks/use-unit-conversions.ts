import { useState, useEffect } from "react";

export interface UnitConversion {
    id: string;
    fromUnitId: string;
    toUnitId: string;
    conversionFactor: number;
    fromUnit: { id: string; name: string; code: string };
    toUnit: { id: string; name: string; code: string };
}

export function useUnitConversions() {
    const [unitConversions, setUnitConversions] = useState<UnitConversion[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchUnitConversions();
    }, []);

    const fetchUnitConversions = async () => {
        try {
            const response = await fetch("/api/unit-conversions");
            if (response.ok) {
                const data = await response.json();
                setUnitConversions(data);
            }
        } catch (error) {
            console.error("Failed to fetch unit conversions:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return { unitConversions, isLoading, refetch: fetchUnitConversions };
}
