import Link from "next/link";
import { Github, Linkedin, Twitter } from "lucide-react";

import { LogoMark } from "@/components/logo";
import { NewsletterForm } from "@/components/marketing/newsletter-form";
import { footerNav, siteConfig } from "@/config/site";

const socials = [
  { label: "GitHub", href: siteConfig.socials.github, Icon: Github },
  { label: "LinkedIn", href: siteConfig.socials.linkedin, Icon: Linkedin },
  { label: "X", href: siteConfig.socials.x, Icon: Twitter },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card">
      <div className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <LogoMark className="size-10" />
              <div>
                <p className="font-display text-lg font-semibold tracking-tight">{siteConfig.name}</p>
                <p className="text-xs text-muted-foreground">{siteConfig.legalName}</p>
              </div>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Real-time monitoring for cross-border payments. Scores, explanations and
              investigation in one workspace.
            </p>
            <NewsletterForm />
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {footerNav.map((group) => (
              <nav key={group.title} aria-label={group.title} className="space-y-3">
                <h2 className="text-xs font-semibold text-muted-foreground">
                  {group.title}
                </h2>
                <ul className="space-y-2">
                  {group.links.map((link) => (
                    <li key={`${group.title}-${link.href}`}>
                      <Link
                        href={link.href}
                        className="text-sm text-foreground/80 underline-offset-4 hover:text-foreground hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span>
              © {year} {siteConfig.legalName}
            </span>
            <span aria-hidden="true">·</span>
            <a className="hover:text-foreground" href={`mailto:${siteConfig.contactEmail}`}>
              {siteConfig.contactEmail}
            </a>
          </div>
          <div className="flex items-center gap-1">
            {socials.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                aria-label={`${siteConfig.name} on ${label}`}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                rel="noreferrer noopener"
                target="_blank"
              >
                <Icon className="size-4" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
