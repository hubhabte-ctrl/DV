/**
 * Material Studio   " the surface instrument (Spec 07   6, stage R4).
 * Public surface consumed by the shell studio registry.
 * Target folder per Plan 06   3.2 (`studios/material-studio/**`).
 *
 * Plan 06   3.4   " per-studio stylesheet colocated with the studio code.
 * Vite chunks it as `material-studio-*.css`.
 */
import './styles/MaterialStudio.css';
/* Side-effect import: registers this studio's inspector with the shell.
   Bare (no bindings) so bundlers keep it   " the module's value is its
   registration, not its exports. */
import './MaterialRegistration';

export { MaterialWorkspace } from './components/viewport/MaterialWorkspace';
;
;
