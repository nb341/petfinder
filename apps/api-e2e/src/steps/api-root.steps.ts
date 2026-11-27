import axios, { AxiosResponse } from 'axios';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { join } from 'node:path';

const feature = loadFeature(join(__dirname, '../features/api-root.feature'));

defineFeature(feature, (test) => {
  let res: AxiosResponse;

  test('Client calls the API root', ({ when, then, and }) => {
    when(/^I send GET "(.*)"$/, async (path: string) => {
      res = await axios.get(path, { validateStatus: () => true });
    });

    then(/^the response status is (\d+)$/, (status: string) => {
      expect(res.status).toBe(Number(status));
    });

    and('the response body is:', (body: string) => {
      expect(res.data).toEqual(JSON.parse(body));
    });
  });
});
