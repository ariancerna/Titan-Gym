import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type QrScanner from 'qr-scanner';
import { Camera, CircleCheck, CircleAlert, ScanLine, X } from 'lucide-react';
import { checkIn } from '../../features/admin/api';
import { classifyScannedCode, reservationCodePattern } from '../../features/admin/checkin';
import { errorMessage } from '../../lib/errors';
import { formatTime } from '../../utils/sessions';
import { Button } from '../ui/Button';

/** Recepción: registra la llegada del socio escaneando el QR de su comprobante o escribiendo el código. */
export function CheckInPanel() {
  const cache = useQueryClient();
  const [code, setCode] = useState('');
  const [inputError, setInputError] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scanError, setScanError] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const scanner = useRef<QrScanner | null>(null);

  const mutation = useMutation({
    mutationFn: checkIn,
    onSuccess: () => {
      // La lista de inscritos y el indicador de no-shows dependen de esta asistencia.
      void cache.invalidateQueries({ queryKey: ['admin', 'roster'] });
      void cache.invalidateQueries({ queryKey: ['admin', 'dataset'] });
    },
  });

  function register(value: string, source: 'manual' | 'camera' = 'manual') {
    const normalized = value.trim().toUpperCase();
    setInputError('');
    setScanError('');
    if (source === 'camera') {
      const scanned = classifyScannedCode(value);
      // Lo leído por la cámara se muestra para que el personal vea qué se escaneó.
      setCode(scanned.code.slice(0, 40));
      if (scanned.kind !== 'code') {
        mutation.reset();
        setScanError(
          scanned.kind === 'foreign'
            ? 'Este QR no es un comprobante de TITAN GYM.'
            : 'Es un comprobante con el formato anterior. Pide al socio que recargue su comprobante en Mis reservas para mostrar el QR nuevo.',
        );
        return;
      }
    } else if (!reservationCodePattern.test(normalized)) {
      setInputError(
        'El código tiene el formato TG- seguido de 6 caracteres, por ejemplo TG-7K4M2Q.',
      );
      return;
    }
    setCode(normalized);
    mutation.mutate(normalized);
  }

  function stopCamera() {
    scanner.current?.destroy();
    scanner.current = null;
    setCameraOn(false);
  }

  async function startCamera() {
    setCameraError('');
    mutation.reset();
    setCameraOn(true);
    try {
      // La librería se descarga solo cuando el personal abre la cámara.
      const { default: QrScannerLib } = await import('qr-scanner');
      if (!(await QrScannerLib.hasCamera())) throw new Error('NO_CAMERA');
      if (!video.current) return;
      scanner.current = new QrScannerLib(
        video.current,
        (result) => {
          stopCamera();
          register(result.data, 'camera');
        },
        {
          preferredCamera: 'environment',
          highlightScanRegion: true,
          returnDetailedScanResult: true,
        },
      );
      await scanner.current.start();
    } catch (e) {
      stopCamera();
      setCameraError(
        e instanceof Error && e.message === 'NO_CAMERA'
          ? 'No se detectó una cámara en este dispositivo. Escribe el código de la reserva.'
          : 'No pudimos abrir la cámara. Revisa el permiso del navegador o escribe el código.',
      );
    }
  }

  useEffect(() => () => scanner.current?.destroy(), []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    register(code);
  }

  const result = mutation.data;

  return (
    <section className="panel checkin-panel" aria-labelledby="checkin-title">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow yellow">Recepción</p>
          <h2 id="checkin-title">Registrar llegada</h2>
          <p>Escanea el QR del comprobante del socio. Se acepta desde 1 hora antes de la clase.</p>
        </div>
        {cameraOn ? (
          <Button variant="secondary" onClick={stopCamera}>
            <X size={16} />
            Cerrar cámara
          </Button>
        ) : (
          <Button onClick={() => void startCamera()}>
            <Camera size={16} />
            Escanear QR
          </Button>
        )}
      </div>

      {cameraOn && (
        <div className="checkin-camera">
          <video
            ref={video}
            muted
            playsInline
            aria-label="Vista de la cámara para escanear el QR"
          />
          <p>
            <ScanLine size={16} aria-hidden="true" />
            Apunta al código QR del comprobante
          </p>
        </div>
      )}
      {cameraError && <p className="notice">{cameraError}</p>}

      <form className="checkin-form" onSubmit={onSubmit} noValidate>
        <label htmlFor="checkin-code">Código de reserva</label>
        <div>
          <input
            id="checkin-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setInputError('');
            }}
            placeholder="TG-7K4M2Q"
            autoComplete="off"
            spellCheck={false}
            maxLength={12}
            aria-invalid={Boolean(inputError)}
            aria-describedby={inputError ? 'checkin-code-error' : undefined}
          />
          <Button variant="secondary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Registrando…' : 'Registrar llegada'}
          </Button>
        </div>
        {inputError && (
          <p id="checkin-code-error" className="field-error" role="alert">
            {inputError}
          </p>
        )}
      </form>

      {result && (
        <div className={`checkin-result ${result.already_present ? 'repeat' : 'ok'}`} role="status">
          <CircleCheck aria-hidden="true" />
          <div>
            <strong>
              {result.already_present ? 'Ya estaba registrado' : 'Llegada registrada'}:{' '}
              {result.member_name}
            </strong>
            <span>
              {result.class_name} · {formatTime(result.starts_at)} · {result.room} · {result.code}
            </span>
          </div>
        </div>
      )}
      {scanError && (
        <div className="checkin-result error" role="alert">
          <CircleAlert aria-hidden="true" />
          <div>
            <strong>No se registró la llegada</strong>
            <span>{scanError}</span>
          </div>
        </div>
      )}
      {mutation.isError && (
        <div className="checkin-result error" role="alert">
          <CircleAlert aria-hidden="true" />
          <div>
            <strong>No se registró la llegada</strong>
            <span>{errorMessage(mutation.error)}</span>
          </div>
        </div>
      )}
    </section>
  );
}
