export function Button({ children, href, variant = 'primary', ...props }) {
  const className = `button button-${variant}`

  if (href) {
    return (
      <a className={className} href={href} {...props}>
        {children}
      </a>
    )
  }

  return (
    <button className={className} type="button" {...props}>
      {children}
    </button>
  )
}
