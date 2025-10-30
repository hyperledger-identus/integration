## Context

End-to-end test for the integration project.

The integration project is an execution handler. It consists in 5 main components. You can see the description in the README.md file in the root of the project.

The output of this project is a generated `public` directory in the root. If the `public` directory is not present it should copy from the `initial-pages` directory. Therefore any changes in the javascript or html should be in the `initial-pages`.

### End-to-end tests goals

The goal is to create a full e2e suite that tests

- The report generation
- The breadcrumbs
- The navigation between pages
- The reports
- The history management

### Testing strategy

- copy `tests/results` to `tmp` folder
  - `tests/results` is the directory that contains an example of `allure results` which are used to generate the report for each component. this is a mocked data to run the `report.ts`, generate the `reports` and create/update the `public` directory. It can be reused to generate any report for speeding up the test.
- delete `public` folder
- use `report-gen.ts` file to generate the report for the component we want (e.g. `tsx report-gen.ts sdk-ts`)
  - lists of testing components: cloud-agent, manual, mediator, sdk-kmp, sdk-swift, sdk-ts, weekly, release
- start a server in the generated `public` folder
- run the end-to-end tests
- create the validations

### Validations

- each link in navbar should work (icon, release, manual) and the dropdowns as well services > mediator; cloud-agent and sdks > typescript, swift, kotlin.
- if the `report-gen.ts` has been executed for a component (e.g. sdk-ts) the report should be seen in the sdks > typescript link
- the breadcrumbs should be validated
- the page is a single page application and the refresh is handled by a 404.html located in the `initial-pages/404.html` which it stores some data in the local storage to load up the right path. if there's the local storage data but it still is not available then we display the actual 404.html (page not found).
- no need to test performance the output is a plain html page (not an application itself)
- no need for accessibility test


### Behaviors

- there are some mapped routes for the reports. if the person opens a component (e.g. weekly) then it opens the report. the index is an auto generated html file located in the `report.ts` file. so it knows the latest report to open (e.g. 8), this report id should appear in the history navigation url (e.g. `localhost:8000/weekly/8`) and also appear in the breadcrumbs (`Home > Weekly > 8`)


### Misc

- use http-server dependency to start the server in `public` directory using port `3030`
- browser targets only chrome for now

### Report generation id handling

- when running `tsx report-gen.ts release <id>` or `tsx report-gen.ts <component>` it has 2 flows
  - normal flow
  - release flow
- the normal flow it reads the current directories in `public/reports/<component>` and determines the next number up to `10` past values. If for example we have the reports 1, 2, 3, ... 10 and generate it again, the next will be `11` but the `1` will be erased.
- release flow for the release we have a variable named `releaseVersion` which is the id of the release and it follows a different path. it generates a info json file to build cards in the `release` page
- everytime the `public` is deleted, the next generation will create the `public` from the `initial-pages` each one contains a report `0` with a simple html inside saying `no reports for <component>`
- the handling system for the storage is automatic, if the route is found the script deletes from the storage. otherwise it displays the `static/404.html` not found