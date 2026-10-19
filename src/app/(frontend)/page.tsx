import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="home">
      <div className="content">
        <h1>Multi-site content management</h1>
        <p>This service hosts the CMS, not your websites.</p>
        <Link href="/admin">Open administration</Link>
      </div>
    </div>
  )
}
