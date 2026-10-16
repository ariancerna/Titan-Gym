import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { classSchema, sessionSchema, limaInputDate } from '../../schemas/admin';
import {
  saveClass,
  saveSession,
  type AdminSnapshot,
  type ManagedClass,
  type ManagedSession,
} from '../../features/admin/api';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { errorMessage } from '../../lib/errors';
import type { ReactNode } from 'react';

function SelectField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field admin-select">
      <label>
        {label}
        {children}
      </label>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
export function ClassEditor({
  data,
  current,
  onSaved,
  onCancel,
}: {
  data: AdminSnapshot;
  current?: ManagedClass;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const lock = useRef(false);
  const form = useForm<z.input<typeof classSchema>, unknown, z.output<typeof classSchema>>({
    resolver: zodResolver(classSchema),
    defaultValues: current
      ? { ...current, image_url: current.image_url ?? '' }
      : { name: '', description: '', discipline_id: '', image_url: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.output<typeof classSchema>) => saveClass(values, current?.id),
    onSuccess: onSaved,
  });
  const photos = [
    ...new Map(
      data.classes.filter((c) => c.image_url).map((c) => [c.image_url!, c.name]),
    ).entries(),
  ];
  return (
    <section className="panel" aria-label="Editor de clase">
      <h2>{current ? 'Editar clase' : 'Nueva clase'}</h2>
      <p>La clase define la actividad. Programa sus horarios por separado.</p>
      <form
        noValidate
        onSubmit={form.handleSubmit((v) => {
          if (!lock.current) {
            lock.current = true;
            mutation.mutate(v, {
              onSettled: () => {
                lock.current = false;
              },
            });
          }
        })}
      >
        <Input
          id="class-name"
          label="Nombre de la clase"
          error={form.formState.errors.name?.message}
          {...form.register('name')}
        />
        <SelectField label="Disciplina" error={form.formState.errors.discipline_id?.message}>
          <select
            {...form.register('discipline_id')}
            aria-invalid={Boolean(form.formState.errors.discipline_id)}
          >
            <option value="">Selecciona una disciplina</option>
            {data.disciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </SelectField>
        <div className="field">
          <label htmlFor="class-description">Descripción</label>
          <textarea
            id="class-description"
            rows={4}
            {...form.register('description')}
            aria-invalid={Boolean(form.formState.errors.description)}
            aria-describedby={form.formState.errors.description ? 'description-error' : undefined}
          />
          {form.formState.errors.description && (
            <p id="description-error" role="alert" className="field-error">
              {form.formState.errors.description.message}
            </p>
          )}
        </div>
        <SelectField
          label="Fotografía de la clase"
          error={form.formState.errors.image_url?.message}
        >
          <select {...form.register('image_url')}>
            <option value="">Selecciona una fotografía</option>
            {photos.map(([url, name]) => (
              <option key={url} value={url}>
                {name}
              </option>
            ))}
          </select>
        </SelectField>
        {mutation.isError && (
          <p role="alert" className="field-error">
            {errorMessage(mutation.error)}
          </p>
        )}
        <div className="admin-actions">
          <Button disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : 'Guardar clase'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={mutation.isPending}
            onClick={onCancel}
          >
            Cancelar edición
          </Button>
        </div>
      </form>
    </section>
  );
}
export function SessionEditor({
  data,
  current,
  onSaved,
  onCancel,
}: {
  data: AdminSnapshot;
  current?: ManagedSession;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const lock = useRef(false);
  const form = useForm<z.input<typeof sessionSchema>, unknown, z.output<typeof sessionSchema>>({
    resolver: zodResolver(sessionSchema),
    defaultValues: current
      ? { ...current, starts_at: limaInputDate(current.starts_at) }
      : {
          class_id: '',
          instructor_id: '',
          location_id: '',
          room: '',
          starts_at: '',
          capacity: 20,
          duration_minutes: 45,
          published: true,
        },
  });
  const mutation = useMutation({
    mutationFn: (v: z.output<typeof sessionSchema>) =>
      saveSession(
        { ...v, starts_at: new Date(`${v.starts_at}:00-05:00`).toISOString() },
        current?.id,
      ),
    onSuccess: onSaved,
  });
  const locked = Boolean(current?.reserved);
  return (
    <section className="panel" aria-label="Editor de sesión">
      <h2>{current ? 'Editar sesión' : 'Nueva sesión'}</h2>
      <p>Todos los horarios se registran en hora de Lima (UTC−5).</p>
      {locked && (
        <p className="notice">
          Esta sesión tiene reservas. Solo puedes modificar su capacidad; no se permite borrar ni
          cambiar los detalles de una sesión reservada.
        </p>
      )}
      <form
        noValidate
        onSubmit={form.handleSubmit((v) => {
          if (!lock.current) {
            lock.current = true;
            mutation.mutate(v, {
              onSettled: () => {
                lock.current = false;
              },
            });
          }
        })}
      >
        <div className="admin-form-grid">
          {(['class_id', 'instructor_id', 'location_id'] as const).map((key, index) => (
            <SelectField
              key={key}
              label={['Clase', 'Instructor', 'Sede'][index]}
              error={form.formState.errors[key]?.message}
            >
              <select
                {...form.register(key)}
                aria-disabled={locked}
                onChange={(e) => {
                  if (!locked) void form.register(key).onChange(e);
                }}
              >
                <option value="">Selecciona una opción</option>
                {(index === 0 ? data.classes : index === 1 ? data.instructors : data.locations).map(
                  (d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ),
                )}
              </select>
            </SelectField>
          ))}
          <Input
            id="session-room"
            label="Sala"
            readOnly={locked}
            error={form.formState.errors.room?.message}
            {...form.register('room')}
          />
          <Input
            id="session-start"
            label="Fecha y hora · Lima"
            type="datetime-local"
            readOnly={locked}
            error={form.formState.errors.starts_at?.message}
            {...form.register('starts_at')}
          />
          <Input
            id="session-duration"
            label="Duración en minutos"
            type="number"
            min={10}
            max={240}
            readOnly={locked}
            error={form.formState.errors.duration_minutes?.message}
            {...form.register('duration_minutes')}
          />
          <Input
            id="session-capacity"
            label="Capacidad máxima"
            type="number"
            min={Math.max(1, current?.reserved ?? 0)}
            max={500}
            error={form.formState.errors.capacity?.message}
            {...form.register('capacity')}
          />
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            {...form.register('published')}
            aria-disabled={locked}
            onChange={(e) => {
              if (!locked) void form.register('published').onChange(e);
            }}
          />
          Publicar en el catálogo
        </label>
        {mutation.isError && (
          <p role="alert" className="field-error">
            {errorMessage(mutation.error)}
          </p>
        )}
        <div className="admin-actions">
          <Button disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : 'Guardar sesión'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={mutation.isPending}
            onClick={onCancel}
          >
            Cancelar edición
          </Button>
        </div>
      </form>
    </section>
  );
}
