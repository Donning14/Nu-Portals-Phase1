import { Page } from '../components/Shell';
import { CONTACT_PREFERENCES, SERVICE_OPTIONS } from '../../shared/catalog';

const topics = ["General question", "Service interest", "Existing project", "Partnership"];

export default function LearnMore() {
  return (
    <Page title="Learn more">
      <p>Tell us what you want to explore. This inquiry is not saved yet, and no message is sent.</p>
      <form className="form" onSubmit={(event) => event.preventDefault()}>
        <label>
          Topic
          <select name="topic" required defaultValue="">
            <option value="" disabled>Select a topic</option>
            {topics.map((topic) => <option key={topic}>{topic}</option>)}
          </select>
        </label>
        <label>
          Service
          <select name="service" required defaultValue="">
            <option value="" disabled>Select a service</option>
            <option>Not sure yet</option>
            {SERVICE_OPTIONS.map((service) => <option key={service}>{service}</option>)}
          </select>
        </label>
        <label>
          Message
          <textarea name="message" required maxLength={2000} placeholder="What would you like to learn?" />
        </label>
        <fieldset>
          <legend>Contact preference</legend>
          {CONTACT_PREFERENCES.map((preference) => (
            <label key={preference}>
              <input type="radio" name="contactPreference" value={preference} required /> {preference}
            </label>
          ))}
        </fieldset>
        <button className="btn" type="submit">Send inquiry</button>
      </form>
    </Page>
  );
}
