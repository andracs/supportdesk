import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('SupportDesk API', () => {
  it('viser mindst tre tickets', async () => {
    const res = await request(app).get('/api/tickets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });

  it('afviser overtagelse med manglende oplysninger', async () => {
    const res = await request(app)
      .post('/api/assignments')
      .send({ ticketId: 'test-id' }); // employeeId mangler
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });
});
