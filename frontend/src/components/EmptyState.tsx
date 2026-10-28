import { Button } from "@/components/ui";

interface EmptyStateProps {
    title?: string;
    description?: string;
    icon?: React.ReactNode;
    action?: {
        label: string;
        onClick: () => void;
        variant?: "solid" | "bordered" | "light" | "flat" | "faded" | "shadow" | "ghost";
        color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
    };
    className?: string;
    size?: "sm" | "md" | "lg";
}

const DefaultIcon = () => (
    <svg
        className="w-16 h-16 text-ink-400 dark:text-ink-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
    </svg>
);

const FloatingIcons = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top left */}
        <div className="absolute top-4 left-8 opacity-20 animate-pulse">
            <svg className="w-6 h-6 text-ink-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3,11H11V3H3M3,21H11V13H3M13,21H21V13H13M13,3V11H21V3" />
            </svg>
        </div>

        {/* Top right */}
        <div className="absolute top-8 right-12 opacity-15 animate-pulse" style={{ animationDelay: '1s' }}>
            <svg className="w-5 h-5 text-ink-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
            </svg>
        </div>

        {/* Middle right */}
        <div className="absolute top-1/2 right-4 opacity-25 animate-pulse" style={{ animationDelay: '2s' }}>
            <svg className="w-7 h-7 text-ink-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3,11H11V3H3M3,21H11V13H3M13,21H21V13H13M13,3V11H21V3" />
            </svg>
        </div>

        {/* Bottom left */}
        <div className="absolute bottom-12 left-4 opacity-20 animate-pulse" style={{ animationDelay: '0.5s' }}>
            <svg className="w-6 h-6 text-ink-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z" />
            </svg>
        </div>

        {/* Bottom right */}
        <div className="absolute bottom-4 right-8 opacity-30 animate-pulse" style={{ animationDelay: '1.5s' }}>
            <svg className="w-5 h-5 text-ink-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8,5.14V19.14L19,12.14L8,5.14Z" />
            </svg>
        </div>

        {/* Additional floating icons */}
        <div className="absolute top-1/3 left-1/4 opacity-10 animate-pulse" style={{ animationDelay: '2.5s' }}>
            <svg className="w-4 h-4 text-ink-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" />
            </svg>
        </div>
    </div>
);

export default function EmptyState({
    title = "No files found",
    description = "Your search did not match any projects. Please try again.",
    icon,
    action,
    className = "",
    size = "md"
}: EmptyStateProps) {
    const sizeClasses = {
        sm: "min-h-[200px] p-4",
        md: "min-h-[300px] p-6",
        lg: "min-h-[400px] p-8"
    };

    const textSizes = {
        sm: { title: "text-lg", description: "text-sm" },
        md: { title: "text-xl", description: "text-sm" },
        lg: { title: "text-2xl", description: "text-base" }
    };

    return (
        <div className={`flex flex-col items-center justify-center ${sizeClasses[size]} ${className}`}>
            {/* Background with floating icons */}
            <div className="relative w-full max-w-md mb-6">
                <FloatingIcons />

                {/* Central icon */}
                <div className="flex justify-center items-center h-24 relative z-10">
                    {icon || <DefaultIcon />}
                </div>
            </div>

            {/* Content */}
            <div className="text-center max-w-md space-y-3">
                <h3 className={`font-semibold text-ink-900 dark:text-white ${textSizes[size].title}`}>
                    {title}
                </h3>
                <p className={`text-ink-500 dark:text-ink-400 leading-relaxed ${textSizes[size].description}`}>
                    {description}
                </p>

                {action && (
                    <div className="pt-4">
                        <Button
                            onClick={action.onClick}
                            variant={action.variant || "solid"}
                            color={action.color || "primary"}
                        >
                            {action.label}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

// Preset variants for common use cases
export const EmptySearchState = (props: Partial<EmptyStateProps>) => (
    <EmptyState
        title="No results found"
        description="We couldn't find any items matching your search. Try adjusting your filters or search terms."
        {...props}
    />
);

export const EmptyDataState = (props: Partial<EmptyStateProps>) => (
    <EmptyState
        title="No data available"
        description="There's no data to display at the moment. Check back later or try refreshing the page."
        {...props}
    />
);

export const EmptyProjectsState = (props: Partial<EmptyStateProps>) => (
    <EmptyState
        title="No projects found"
        description="You haven't created any projects yet. Get started by creating your first project."
        action={{
            label: "Create Project",
            onClick: () => console.log("Create project clicked"),
            color: "primary"
        }}
        {...props}
    />
);