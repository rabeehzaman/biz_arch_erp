"use client";

import { motion } from "framer-motion";

export function PageAnimation({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <motion.div
            initial={{ opacity: 0.6, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

export function StaggerContainer({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={{
                hidden: { opacity: 0.6 },
                visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.03 },
                },
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <motion.div
            variants={{
                hidden: { opacity: 0.6, y: 4 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.15, ease: "easeOut" } },
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
