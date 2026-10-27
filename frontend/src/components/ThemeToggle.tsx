import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button, Tooltip } from "@/components/ui";
import { getTheme, onThemeChange, setTheme, type Theme } from "@/lib/theme";

// Topbar Dark / Light switch (THEME-01)
export default function ThemeToggle() {
    const [theme, setLocal] = useState<Theme>(getTheme);
    useEffect(() => onThemeChange(setLocal) as () => void, []);

    const next: Theme = theme === "dark" ? "light" : "dark";
    return (
        <Tooltip content={`Switch to ${next} mode`} placement="bottom">
            <Button
                isIconOnly
                size="sm"
                variant="light"
                aria-label={`Switch to ${next} mode`}
                onPress={() => setTheme(next)}
            >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
        </Tooltip>
    );
}
