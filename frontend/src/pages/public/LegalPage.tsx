import { legal, type LegalPageTitle } from '../../content/legal'
import { useLocale } from '../../i18n/LocaleContext'
import styles from './LegalPage.module.css'

export function LegalPage({ title }: { title: LegalPageTitle }) {
  const { locale, t } = useLocale()
  const document = legal[locale][title]

  return (
    <article className={styles.page}>
      <p className={styles.notice}>{document.notice}</p>
      <h1>{t(title)}</h1>
      <p className={styles.language}>{document.language}</p>
      {document.sections.map(section => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          {section.list && <ul>{section.list.map(item => <li key={item}>{item}</li>)}</ul>}
        </section>
      ))}
    </article>
  )
}
