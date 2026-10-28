// Empty container component for displaying no files found state

interface EmptyContainerProps {
    title?: string;
    description?: string;
    icon?: React.ReactNode;
}

// Default file icons
const FileIcon = () => (
    <svg
        className="w-8 h-8 text-ink-300"
        fill="currentColor"
        viewBox="0 0 24 24"
    >
        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
    </svg>
);

const FolderIcon = () => (
    <svg
        className="w-8 h-8 text-ink-300"
        fill="currentColor"
        viewBox="0 0 24 24"
    >
        <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z" />
    </svg>
);

const GridIcon = () => (
    <svg
        className="w-8 h-8 text-ink-300"
        fill="currentColor"
        viewBox="0 0 24 24"
    >
        <path d="M3,11H11V3H3M3,21H11V13H3M13,21H21V13H13M13,3V11H21V3" />
    </svg>
);

const PlayIcon = () => (
    <svg
        className="w-8 h-8 text-ink-300"
        fill="currentColor"
        viewBox="0 0 24 24"
    >
        <path d="M8,5.14V19.14L19,12.14L8,5.14Z" />
    </svg>
);

const ImageIcon = () => (
    <svg
        className="w-8 h-8 text-ink-300"
        fill="currentColor"
        viewBox="0 0 24 24"
    >
        <path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" />
    </svg>
);

export default function EmptyContainer({
    title = "No files found",
    description = "Your search did not match any projects. Please try again.",
    icon
}: EmptyContainerProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 w-full">
            {/* Floating Icons Background */}
            <div className="relative w-full max-w-md mb-8">
                <div className="absolute top-0 left-8 opacity-30">
                    <GridIcon />
                </div>
                <div className="absolute top-4 right-12 opacity-20">
                    <FileIcon />
                </div>
                <div className="absolute top-12 right-4 opacity-25">
                    <GridIcon />
                </div>
                <div className="absolute top-16 right-20 opacity-15">
                    <ImageIcon />
                </div>
                <div className="absolute bottom-8 left-4 opacity-20">
                    <FolderIcon />
                </div>
                <div className="absolute bottom-4 left-16 opacity-25">
                    <FileIcon />
                </div>
                <div className="absolute bottom-0 right-8 opacity-30">
                    <PlayIcon />
                </div>

                {/* Central Document Icon */}
                <div className="flex justify-center items-center h-32">
                    {icon || (
                        <svg
                            className="w-16 h-16 text-ink-400 dark:text-ink-500"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                        >
                            <path
                                d="M3 7.5L12 3l9 4.5-9 4.5-9-4.5z"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <path
                                d="M3 7.5v9L12 21l9-4.5v-9"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>

                    )}
                </div>
            </div>

            {/* Content */}
            <div className="text-center max-w-md">
                <h3 className="text-xl font-semibold text-ink-900 dark:text-white mb-2">
                    {title}
                </h3>
                {/* <p className="text-ink-500 dark:text-ink-400 text-sm leading-relaxed">
                    {description}
                </p> */}
            </div>
        </div>
    );
}