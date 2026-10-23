import { useEffect, useState, useCallback } from 'react';
import { get, type Edition, type RegistrationConfig } from '@/lib/miihApi';
import { TeamRegistrationDialog } from '../components/TeamRegistrationDialog';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ROUTES } from '@/constants/routes';
import { SITE } from '@/constants/app';
import { PARTICIPATION_FAQS } from '@/constants/hackathon';
import { HackathonBenefits } from '@/components/common/HackathonBenefits';
import '../styles/registration.css';

export function RegisterPage({ embedded = false }: { embedded?: boolean }) {
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const closeRegistration=useCallback(()=>setRegistrationOpen(false),[]);
  const [edition,setEdition] = useState<Edition|null>(null);
  const [loadError,setLoadError]=useState('');
  const [blocks,setBlocks]=useState<Array<{block_key:string;block_type:string;title:string;body:string}>>([]);
  const code=String('MIIH_UPCOMING');
  useEffect(()=>{
    let active=true;let revision=0;
    async function load(){
      const request=++revision;const current=()=>active&&request===revision;
      if(code==='MIIH_TEST_48H'){
        try{const data=await get<RegistrationConfig>(`/public/test-editions/${code}/registration-config`,true);
          if(current()){setEdition(data.edition);setLoadError('');}
        }catch(error){if(current()){setEdition(null);setLoadError(error instanceof Error?error.message:'Unable to load this event.');}}
      }else{
        try{const all=await get<Edition[]>('/public/editions');
          if(current()){setEdition(all.find(x=>x.edition_code===code)||null);setLoadError('');}
        }catch(error){if(current())setLoadError(error instanceof Error?error.message:'Unable to load event details.');}
        try{const items=await get<typeof blocks>(`/public/editions/${code}/content`);
          if(current())setBlocks(items);
        }catch{/* Existing site copy remains available until content is published. */}
      }
    }
    void load();
    const onUpdate=()=>void load();
    const onVisible=()=>{if(document.visibilityState==='visible')void load();};
    const onStorage=(event:StorageEvent)=>{if(event.key==='miih:last-update')void load();};
    window.addEventListener('storage',onStorage);
    window.addEventListener('focus',onUpdate);
    window.addEventListener('miih:data-updated',onUpdate);
    document.addEventListener('visibilitychange',onVisible);
    const timer=window.setInterval(onVisible,15000);
    return()=>{active=false;window.removeEventListener('storage',onStorage);window.clearInterval(timer);window.removeEventListener('focus',onUpdate);
      window.removeEventListener('miih:data-updated',onUpdate);document.removeEventListener('visibilitychange',onVisible);};
  },[code]);
  const faqs=blocks.filter(item=>item.block_type==='FAQ');
  const notices=blocks.filter(item=>item.block_type==='ANNOUNCEMENT'||item.block_type==='INSTRUCTION');
  const open=edition?.status==='OPEN';
  const dateDisplay=(raw?:string|null)=>raw?new Date(raw).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}):'To be announced';
  const Title = embedded ? 'h2' : 'h1';

  return (
    <>
      {loadError&&<p className="container" role="alert">{loadError} Refresh to try again.</p>}
      <section className="page-hero" data-event-managed="true">
        <div className="container">
          {!embedded && <Link className="back-link" to={ROUTES.HOME}>
            <Icon name="arrow" /> Back to home
          </Link>}
          <p className="eyebrow">{open?'REGISTRATION OPEN':'THE NEXT EDITION'}</p>
          <Title className="page-title">
            {edition?.title||'Made in India Hackathon'}
          </Title>
          <p className="page-intro">
            {edition?.description||'The next Made in India hackathon is coming soon. This is where you’ll find everything you need to take part once the details are announced.'}
          </p>
        </div>
      </section>

      <section data-event-managed="true" className="section register-section" aria-labelledby="event-title">
        <div className="container register-grid">
          <div className="event-panel">
            <span className="status-badge">
              <span className="status-dot" aria-hidden="true"></span> {open?'REGISTRATION OPEN':edition?.status==='CLOSED'?'REGISTRATION CLOSED':'COMING SOON'}
            </span>
            <h2 id="event-title">{edition?.title||'Made in India'}</h2>
            <p className="section-copy">
              {edition?.tagline||'Bring a problem you care about and the curiosity to explore it. Made in India by ZeAI Soft brings students and emerging innovators together to develop, refine, and share their ideas.'}
            </p>
            <dl className="detail-list">
              <div className="detail-row">
                <dt>
                  <Icon name="calendar" /> Date
                </dt>
                <dd>{dateDisplay(edition?.starts_at)}</dd>
              </div>
              <div className="detail-row">
                <dt>
                  <Icon name="pin" /> Venue / mode
                </dt>
                <dd>{edition?.venue||edition?.location||'To be announced'}{edition?.event_mode?' · '+edition.event_mode:''}</dd>
              </div>
              <div className="detail-row">
                <dt>
                  <Icon name="users" /> Who can participate
                </dt>
                <dd>{edition?.eligibility_text||'Eligibility rules to be announced'}</dd>
              </div>
              <div className="detail-row">
                <dt>
                  <Icon name="code" /> Individual / team format
                </dt>
                <dd>{edition?.min_team_size&&edition?.max_team_size?(edition.min_team_size===edition.max_team_size?`${edition.min_team_size} members per team (including leader)`:`${edition.min_team_size}–${edition.max_team_size} members per team (including leader)`):'To be announced'}</dd>
              </div>
              <div className="detail-row">
                <dt>
                  <Icon name="clock" /> Registration deadline
                </dt>
                <dd>{dateDisplay(edition?.registration_closes_at)}</dd>
              </div>
            </dl>
            <p className="registration-note">
              {edition?.guidelines_text||'Participation guidelines and any fees will be confirmed with the event announcement.'}
            </p>
          </div>
          <aside className="registration-panel" aria-labelledby="registration-title">
            <span className="registration-icon" aria-hidden="true">
              <Icon name="spark" />
            </span>
            <p className="eyebrow">YOUR NEXT CHAPTER</p>
            <h2 id="registration-title">
              {open?'Ready to build?':'Stay curious.'}
              <br />
              {open?'Register your team.':'We’ll see you soon.'}
            </h2>
            <p>
              {open?'Enter your team details, complete the questions and follow the payment and submission instructions.':'Our team registration popup collects your leader and member details when the event opens.'}
            </p>
            <button
              className="button button-primary"
              type="button"
              data-registration-status=""
              disabled={!open}
              onClick={() => setRegistrationOpen(true)}
            >
              Register here <Icon name="arrow" />
            </button>
            <p className="registration-note">{open?'Complete every applicable required field before submitting.':'The form is available when registration is published by the organizer.'}</p>
            <div className="registration-contact">
              <p>Have a question in the meantime?</p>
              <a className="text-link" href={`mailto:${SITE.EMAIL}`}>
                {SITE.EMAIL} <Icon name="external" />
              </a>
            </div>
          </aside>
        </div>
      </section>

      {notices.length>0&&<section className="section" aria-label="Event announcements">
        <div className="container"><h2 className="section-heading">Important updates</h2>
          <div className="participation-faqs">{notices.map(item=><details open key={item.block_key}>
            <summary>{item.title}</summary><p>{item.body}</p>
          </details>)}</div></div>
      </section>}
      {!embedded && <HackathonBenefits compact />}

      <section className="section registration-how" aria-labelledby="registration-how-title">
        <div className="container">
          <div className="section-grid">
            <div>
              <p className="eyebrow">{open?'HOW TO REGISTER':'WHEN REGISTRATION OPENS'}</p>
              <h2 className="section-heading" id="registration-how-title">
                A few simple steps
                <br />
                to get started.
              </h2>
            </div>
            <p className="section-copy">
              The online team registration form opens here when entries begin. Check the edition’s eligibility rules before submitting your details.
            </p>
          </div>
          <ol className="steps-list feature-grid">
            <li className="feature">
              <span className="feature-number" aria-hidden="true">
                01
              </span>
              <h3>Check the details.</h3>
              <p>
                Read the event announcement, eligibility guidelines, and participation format on
                this page.
              </p>
            </li>
            <li className="feature">
              <span className="feature-number" aria-hidden="true">
                02
              </span>
              <h3>Open the registration form.</h3>
              <p>Enter your team details and complete the registration popup right here.</p>
            </li>
            <li className="feature">
              <span className="feature-number" aria-hidden="true">
                03
              </span>
              <h3>Follow the next steps.</h3>
              <p>Review the instructions provided in the form before completing your submission.</p>
            </li>
          </ol>
        </div>
      </section>

      <section id="faq" tabIndex={-1} className="section" aria-labelledby="participation-faq-title">
        <div className="container">
          <div className="section-grid">
            <div>
              <p className="eyebrow">BEFORE YOU JOIN</p>
              <h2 className="section-heading" id="participation-faq-title">
                A little clarity.
                <br />A better start.
              </h2>
            </div>
            <p className="section-copy">
              Here’s what we know so far. The next edition’s official announcement will confirm the
              remaining participation details.
            </p>
          </div>
          <div className="participation-faqs">
            {faqs.length?faqs.map(faq=><details key={faq.block_key}>
              <summary>{faq.title}</summary><p>{faq.body}</p>
            </details>):PARTICIPATION_FAQS.map(faq=><details key={faq.question}>
              <summary>{faq.question}</summary><p>{faq.answer}</p>
            </details>)}
          </div>
        </div>
      </section>

      <TeamRegistrationDialog open={registrationOpen} onClose={closeRegistration} />
    </>
  );
}
