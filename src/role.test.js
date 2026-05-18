// Confirms catalog visibility behaves correctly for each role. The on-server
// claim assignment is exercised by integration tests against the Firebase
// emulator; this file is just for the pure client-side filter logic.

import { describe, it, expect } from 'vitest';
import { audienceVisible, visibleForRole } from './role.js';

describe('audienceVisible', () => {
  it('shows widgets with no audience tag to everyone', () => {
    for (const role of ['guest', 'student', 'teacher', 'admin']) {
      expect(audienceVisible(undefined, role)).toBe(true);
      expect(audienceVisible('all', role)).toBe(true);
    }
  });

  it('hides teacher widgets from students', () => {
    expect(audienceVisible('teacher', 'student')).toBe(false);
    expect(audienceVisible('teacher', 'guest')).toBe(false);
  });

  it('shows teacher widgets to teachers and admins', () => {
    expect(audienceVisible('teacher', 'teacher')).toBe(true);
    expect(audienceVisible('teacher', 'admin')).toBe(true);
  });

  it('hides student-only widgets from teachers (but admins see everything)', () => {
    expect(audienceVisible('student', 'teacher')).toBe(false);
    expect(audienceVisible('student', 'admin')).toBe(true);
  });
});

describe('visibleForRole', () => {
  const widgets = [
    { id: 'a', audience: 'all' },
    { id: 'b' }, // no tag = same as 'all'
    { id: 'c', audience: 'teacher' },
    { id: 'd', audience: 'student' },
  ];

  it('students see all + untagged + student-only', () => {
    const ids = visibleForRole(widgets, 'student').map((w) => w.id).sort();
    expect(ids).toEqual(['a', 'b', 'd']);
  });

  it('teachers see all + untagged + teacher-only', () => {
    const ids = visibleForRole(widgets, 'teacher').map((w) => w.id).sort();
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('admins see everything', () => {
    const ids = visibleForRole(widgets, 'admin').map((w) => w.id).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });
});
