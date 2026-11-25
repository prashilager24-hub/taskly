-- Undo 029
DROP TABLE IF EXISTS VariablePayReview;
DROP TABLE IF EXISTS VariablePayRequest;
DROP TABLE IF EXISTS VariablePayTarget;
DELETE FROM AppSetting WHERE SettingKey = 'variablePaySlabs';
