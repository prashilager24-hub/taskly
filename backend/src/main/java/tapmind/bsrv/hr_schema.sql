-- HR Modules Database Schema
-- For MariaDB / MySQL

CREATE TABLE IF NOT EXISTS onboarding_surveys (
    id            VARCHAR(10)   PRIMARY KEY,
    employee_id   INT           NOT NULL,
    employee_name VARCHAR(100)  NOT NULL,
    department    VARCHAR(100)  NOT NULL,
    joined_date   DATE          NOT NULL,
    sent_on       DATE          NOT NULL,
    due_date      DATE          NOT NULL,
    status        ENUM('PENDING','SUBMITTED','NO_RESPONSE') NOT NULL DEFAULT 'PENDING',
    answers       JSON          DEFAULT NULL,
    feedback      TEXT          DEFAULT NULL,
    created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queries (
    id              VARCHAR(10)  PRIMARY KEY,
    employee_id     INT          NOT NULL,
    employee_name   VARCHAR(100) NOT NULL,
    department      VARCHAR(100) NOT NULL,
    team            ENUM('HR','L_D')       NOT NULL,
    category        ENUM('PAYROLL','LEAVE','POLICY','BENEFITS','TRAINING','CERTIFICATION','NOMINATION','OTHER') NOT NULL,
    subject         VARCHAR(200) NOT NULL,
    description     TEXT         NOT NULL,
    priority        ENUM('LOW','NORMAL','HIGH') NOT NULL DEFAULT 'NORMAL',
    raised_on       DATE         NOT NULL,
    age_hours       INT          NOT NULL DEFAULT 0,
    status          ENUM('OPEN','IN_PROGRESS','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
    ratings         JSON         DEFAULT NULL,
    rating_comment  TEXT         DEFAULT NULL,
    reopen_reason   TEXT         DEFAULT NULL,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS query_messages (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    query_id    VARCHAR(10)  NOT NULL,
    author      VARCHAR(100) NOT NULL,
    text        TEXT         NOT NULL,
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_query_messages_query_id (query_id)
);

CREATE TABLE IF NOT EXISTS engagement_surveys (
    id        VARCHAR(10)  PRIMARY KEY,
    quarter   VARCHAR(100) NOT NULL,
    months    JSON         NOT NULL,
    sent_to   INT          NOT NULL,
    opens     DATE         NOT NULL,
    closes    DATE         NOT NULL,
    status    ENUM('COLLECTING','CLOSED') NOT NULL DEFAULT 'COLLECTING',
    created_at DATETIME    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS engagement_responses (
    id              INT          AUTO_INCREMENT PRIMARY KEY,
    survey_id       VARCHAR(10)  NOT NULL,
    respondent_id   INT          NOT NULL,
    respondent_name VARCHAR(100) NOT NULL,
    anonymous       BOOLEAN      NOT NULL DEFAULT FALSE,
    months          JSON         NOT NULL,
    rest            JSON         NOT NULL,
    feedback        TEXT         DEFAULT NULL,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_engagement_responses_survey_id (survey_id),
    UNIQUE INDEX uq_one_response_per_person (survey_id, respondent_id)
);
