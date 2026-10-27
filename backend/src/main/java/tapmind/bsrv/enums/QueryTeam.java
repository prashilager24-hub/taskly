package tapmind.bsrv.enums;

public enum QueryTeam {
    HR,
    L_D;

    public static QueryTeam fromString(String value) {
        if (value == null) return null;
        return switch (value.toUpperCase()) {
            case "HR" -> HR;
            case "L&D", "L_D", "LD" -> L_D;
            default -> throw new IllegalArgumentException("Invalid team: " + value);
        };
    }
}
