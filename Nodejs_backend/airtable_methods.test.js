process.env.course_base = 'course';
process.env.studentBase = 'studentBase';
process.env.studentTable = 'studentTable';
process.env.personal_access_token = 'token';

const airtable = require('./airtable_methods');

describe('markDayComplete', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('updates Airtable record for the next day', async () => {
    const number = '1234567890';

    jest.spyOn(airtable, 'totalDays').mockResolvedValue(2);

    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          records: [{ id: 'rec1', fields: { Name: 'Test', Course: 'Course1', 'Next Day': 1 } }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

    await airtable.markDayComplete(number);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toContain(process.env.studentBase);
    expect(fetch.mock.calls[1][0]).toContain('rec1');
    expect(fetch.mock.calls[1][1].method).toBe('PATCH');
    expect(airtable.totalDays).toHaveBeenCalledWith(number);
  });
});

