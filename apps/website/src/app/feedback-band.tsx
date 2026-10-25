import {
  FEEDBACK_ISSUES_HREF,
  FEEDBACK_ISSUES_LIST_HREF,
  STUDIO_CONTACT_HREF,
  STUDIO_SERVICES_HREF,
} from "./site-links";

/**
 * Trust strip under every page: active maintenance · feedback · custom services.
 * Product demos stay on /guide (GIF/MP4 shelf). Commercial inquire via studio.
 */
export function FeedbackBand() {
  return (
    <aside className="feedback-band" aria-labelledby="feedback-band-title">
      <div className="feedback-band-geo" aria-hidden="true" />
      <div className="feedback-band-inner">
        <div className="feedback-band-copy">
          <p className="eyebrow">Open beta · Maintained</p>
          <h2 id="feedback-band-title">Built in the open — still moving</h2>
          <p>
            Obscur is actively maintained and improved. Feedback on bugs, UX rough edges, or
            honesty gaps is welcome on GitHub. For customized private-trust setups or related
            engineering work, inquire through the maintainer studio.
          </p>
        </div>
        <div className="feedback-band-actions">
          <a className="button button-primary" href={FEEDBACK_ISSUES_HREF} target="_blank" rel="noreferrer">
            Send feedback
          </a>
          <a
            className="button button-secondary"
            href={STUDIO_SERVICES_HREF}
            target="_blank"
            rel="noreferrer"
          >
            Custom services
          </a>
          <a
            className="button button-secondary"
            href={STUDIO_CONTACT_HREF}
            target="_blank"
            rel="noreferrer"
          >
            Contact studio
          </a>
          <a
            className="button button-secondary"
            href={FEEDBACK_ISSUES_LIST_HREF}
            target="_blank"
            rel="noreferrer"
          >
            Open issues
          </a>
        </div>
      </div>
    </aside>
  );
}
