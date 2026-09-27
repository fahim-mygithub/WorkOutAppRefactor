import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import workout, { startWorkout } from '../store/slices/workoutSlice';
import { BottomNavigation } from './BottomNavigation';

function renderNav(path: string, active = false) {
  const store = configureStore({ reducer: { workout } });
  if (active) store.dispatch(startWorkout({ name: 'Push', exercises: [] }));
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <BottomNavigation />
      </MemoryRouter>
    </Provider>,
  );
}

const link = (name: string) => screen.getByRole('link', { name });
const lit = (name: string) => link(name).className.includes('text-accent');

describe('BottomNavigation', () => {
  it('Workout opens the build chooser when nothing is running; Build opens the custom builder', () => {
    renderNav('/');
    expect(link('Workout')).toHaveAttribute('href', '/build');
    expect(link('Build')).toHaveAttribute('href', '/build/custom');
  });

  it('Workout goes to the live workout when one is running', () => {
    renderNav('/', true);
    expect(link('Workout')).toHaveAttribute('href', '/workout');
  });

  it('lights exactly one of Workout / Build for each build route', () => {
    renderNav('/build');
    expect(lit('Workout')).toBe(true);
    expect(lit('Build')).toBe(false);
  });

  it('the custom builder lights Build only', () => {
    renderNav('/build/custom');
    expect(lit('Build')).toBe(true);
    expect(lit('Workout')).toBe(false);
  });
});
