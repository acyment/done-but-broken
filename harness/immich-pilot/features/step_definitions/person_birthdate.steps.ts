import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { ApiWorld, PersonResponse } from '../support/world';

Given(
  'a person is created with name {string} and birth date {string}',
  async function (this: ApiWorld, name: string, birthDate: string) {
    // Literal pass-through of both step params; no reformatting.
    const created = await this.request('POST', '/people', { name, birthDate });
    assert.ok(
      created != null && created.id !== undefined && created.id !== null,
      `POST /people did not return a usable id; got: ${JSON.stringify(created)}`,
    );
    this.createdPersonId = created.id; // stored as-is
  },
);

When('I fetch that person by id', async function (this: ApiWorld) {
  assert.ok(
    this.createdPersonId !== undefined && this.createdPersonId !== null,
    'No person id was captured from the create step; cannot fetch',
  );
  const id = encodeURIComponent(String(this.createdPersonId)); // encode for URL only
  this.fetchedPerson = (await this.request('GET', `/people/${id}`)) as PersonResponse;
});

Then(
  'the returned birth date is {string}',
  function (this: ApiWorld, expected: string) {
    assert.ok(
      this.fetchedPerson !== undefined &&
        this.fetchedPerson !== null &&
        typeof this.fetchedPerson === 'object',
      'No person object was fetched; the When step did not run or returned no body',
    );
    // THE load-bearing line: raw === on exactly the scenario's value.
    // Do NOT add trim/String()/Date/normalization here — that would make the
    // adapter non-inert and could mask a real drift (e.g. a server-side
    // reformatting that changes the observable date). Such drift MUST fail here.
    assert.strictEqual(
      this.fetchedPerson.birthDate,
      expected,
      `Expected birthDate ${JSON.stringify(expected)} but API returned ` +
        `${JSON.stringify(this.fetchedPerson.birthDate)}`,
    );
  },
);
