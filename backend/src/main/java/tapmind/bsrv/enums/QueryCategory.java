
package tapmind.bsrv.enums;

public enum QueryCategory {
    PAYROLL, LEAVE, ATTENDANCE, POLICY, BENEFITS, TRAINING, CERTIFICATION, NOMINATION, OTHER;

    public static QueryCategory fromString(String value) {
        if (value == null)
            return null;
        return switch (value.toUpperCase()) {
            case "PAYROLL" -> PAYROLL;
            case "LEAVE" -> LEAVE;
            case "ATTENDANCE" -> ATTENDANCE;
            case "POLICY" -> POLICY;
            case "BENEFITS" -> BENEFITS;
            case "TRAINING" -> TRAINING;
            case "CERTIFICATION" -> CERTIFICATION;
            case "NOMINATION" -> NOMINATION;
            case "OTHER" -> OTHER;
            default -> throw new IllegalArgumentException("Invalid category: " + value);
        };
    }
}
