package tapmind.bsrv.enums;

public enum QueryPriority {
    LOW,
    NORMAL,
    HIGH;

    public static QueryPriority fromString(String value) {
        if (value == null) return NORMAL;
        return switch (value.toUpperCase()) {
            case "LOW" -> LOW;
            case "NORMAL" -> NORMAL;
            case "HIGH" -> HIGH;
            default -> NORMAL;
        };
    }
}
