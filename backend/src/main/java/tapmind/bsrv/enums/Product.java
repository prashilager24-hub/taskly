package tapmind.bsrv.enums;

public enum Product {
    TAPMIND_SDK("TapMind SDK"),
    DISPLAY_AD_SERVER("Display Ad Server"),
    VIDEO_AD_SERVER("Video Ad Server"),
    HADS_SERVER("Hads Server"),
    PROXY_SERVER("Proxy Server"),
    ADCACHE("AdCache"),
    MEDIATION_ADAPTER("Mediation Adapter"),
    PUBLISHER_DASHBOARD("Publisher Dashboard"),
    INTERNAL_TOOLS("Internal Tools"),
    OTHER("Other");

    private final String label;

    Product(String label) { this.label = label; }

    public String getLabel() { return label; }
}
