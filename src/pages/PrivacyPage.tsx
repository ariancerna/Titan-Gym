import {
  gymOwner,
  privacyContactEmail,
  privacyPolicyVersion,
  privacySections,
} from '../content/privacy';
import { formatDate } from '../utils/sessions';

export default function PrivacyPage() {
  return (
    <div className="container page">
      <div className="page-heading">
        <p className="eyebrow yellow">FitSmart Agenda · TITAN GYM</p>
        <h1>Política de privacidad</h1>
        <p>Versión vigente desde el {formatDate(`${privacyPolicyVersion}T12:00:00-05:00`)}.</p>
      </div>
      <article className="privacy-policy">
        {privacySections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.intro && <p>{section.intro}</p>}
            {section.items && (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {section.paragraphs?.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </section>
        ))}
        <section>
          <h2>9. Cómo ejercer tus derechos</h2>
          <p>
            Acércate a la recepción de {gymOwner.address}
            {privacyContactEmail ? (
              <>
                {' '}
                o escribe desde el correo de tu cuenta a{' '}
                <a href={`mailto:${privacyContactEmail}`}>{privacyContactEmail}</a>
              </>
            ) : null}
            . Indica qué derecho quieres ejercer; para proteger tu cuenta, verificaremos que la
            solicitud venga de su titular.
          </p>
        </section>
        <section>
          <h2>10. Cambios en esta política</h2>
          <p>
            Si la modificamos de forma relevante, actualizaremos la fecha de versión y te pediremos
            aceptarla de nuevo antes de tu siguiente reserva.
          </p>
        </section>
      </article>
    </div>
  );
}
