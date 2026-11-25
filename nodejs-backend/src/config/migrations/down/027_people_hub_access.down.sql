-- Undo 027: take the People Hub defaults off every role
UPDATE AMRole SET RolePrivileges = JSON_REMOVE(RolePrivileges,
    '$.hubg_dashboard', '$.hub_dashboard_pms', '$.hubg_pms', '$.hub_taskly_goals', '$.hubg_variable_pay',
    '$.hub_variable_pay_my', '$.hub_variable_pay_policy', '$.hub_variable_pay_team', '$.hub_variable_pay_finance', '$.hub_variable_pay_eligibility',
    '$.hub_variable_pay_payouts', '$.hub_variable_pay_history', '$.hub_variable_pay_queries')
  WHERE RolePrivileges IS NOT NULL AND RolePrivileges <> '' AND JSON_VALID(RolePrivileges);
