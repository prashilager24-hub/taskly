taskly revamp into a enterprise level application
login page with 2f authentication 
and if the user is logged in his credential should not be logged in other browser
and the login 2f should be enabled or disabled from the admin

create a proper user previlages and setup the user access correctly and define the previlages that can be categoried based on the userprevilages 
there are 
1	Admin
2	normalUser
3	ExecutiveLeader
4	FunctionalLeader
5	Intern
6	Executive
7	Manager
23	Lead


1) department and form section where he employee can enter the tasks and targets but the goal form is only entered by the admin by selecting the department and the user dropdown but for other users their own department and userid will be autoselected and would not let them select other options from the localstorage login data
and call all the apis using redux tool kit setup 
they can also import the excel of their task and target works 
and keep a preview panel of their task and target and goal entered before submission so they can edit the things
2) in report section 
a) performance insights show the table with the performance data and with filter,daterange which should be in access role controle
b) user data where all the task and target entries data shown with filter and daterange which should be in access role controle
c) goals achieved all the goals entries will be show with filter and daterange which should be in access role controle
d) entry approval here all the goal entries and the target will be just approved or rejected by the els or reporting manager which should be in access role controle
e) user history here based on the userid the data will be fetched so the user department jump can be tracked
d) query report here based on the query the user will be fetched which can be made by integrating ai since it is just fetched based on the filter

3)admin
a)access management this has the user adding and user edit and role access also which should be giving controles to all the based on roles and based on the module and based on the filters everything 
b)department management here the department is created deleted archived and updated
c)sub departments are linked with deparment and also the fl and el will be mapped here
d)task management where all the tasks for particular department will be added updated and achrived or deleted 
e)target management where all the tasks for particular department will be added updated and achrived or deleted 
f)Goal management where all the tasks for particular department will be added updated and achrived or deleted 
4) hr feedback based on the employee employee tabs shown same way hr / L&d is there and admin 
which has three section onboarding,query,feedback

5)pms which has monthly review tab,quarterly review tab,dashboard and report
report is for admin quarterly and monthly is for the manager,fl nd el dashboard is for all   