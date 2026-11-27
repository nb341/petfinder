// Generated from: src/features/home.feature
import { test } from "playwright-bdd";

test.describe('Home page', () => {

  test('Visitor sees the welcome message', { tag: ['@ui'] }, async ({ When, Then, page }) => { 
    await When('I open the home page', null, { page }); 
    await Then('I see a heading containing "Welcome"', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('src/features/home.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":7,"tags":["@ui"],"steps":[{"pwStepLine":7,"gherkinStepLine":8,"keywordType":"Action","textWithKeyword":"When I open the home page","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":9,"keywordType":"Outcome","textWithKeyword":"Then I see a heading containing \"Welcome\"","stepMatchArguments":[{"group":{"start":27,"value":"\"Welcome\"","children":[{"start":28,"value":"Welcome","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
]; // bdd-data-end