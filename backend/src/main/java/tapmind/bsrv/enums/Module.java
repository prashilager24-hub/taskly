package tapmind.bsrv.enums;

public enum Module {
    ANDROID_SDK("Android SDK"),
    IOS_SDK("iOS SDK"),
    WEB_SDK("Web SDK"),
    AD_REFRESH("Ad Refresh"),
    MEDIATION("Mediation"),
    ORTB_DEMAND("oRTB / Demand"),
    GAM_ADMOB("GAM / AdMob"),
    UNITY_LEVELPLAY("Unity LevelPlay"),
    MAX_APPLOVIN("MAX (AppLovin)"),
    BACKEND_API("Backend API"),
    PIPELINE_KAFKA("Pipeline / Kafka"),
    AEROSPIKE("Aerospike"),
    CLICKHOUSE("ClickHouse"),
    DEVOPS_INFRA("DevOps / Infra"),
    DOCS_QA("Docs / QA"),
    OTHER("Other");

    private final String label;

    Module(String label) { this.label = label; }

    public String getLabel() { return label; }
}
