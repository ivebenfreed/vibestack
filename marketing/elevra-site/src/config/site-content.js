// Centralized site content configuration
// Easy to edit all copy in one place

export const siteContent = {
  // Site metadata
  metadata: {
    title: "Elevra - Custom Data Tables That Fit Your Business Perfectly",
    description: "Design tables exactly how you work. Link everything with real database relationships. No broken connections, no slow queries, no limits."
  },

  // Hero section
  hero: {
    badge: "🚀 LAUNCHING SOON",
    headline: {
      line1: "Relationship Problems?",
      line2: "Meet",
      highlight: "Elevra"
    },
    subheading: {
      main: "Custom tables that match your business perfectly.",
      accent: "With real database relationships that actually work."
    },
    badges: [
      { icon: "⚡", text: "Instant Tables" },
      { icon: "🚀", text: "Lightning Fast" },
      { icon: "🔄", text: "Always Synced" }
    ],
    leadCapture: {
      title: "Start Building in Seconds",
      subtitle: "Early access to the fastest way to create custom data tables",
      privacyNote: "We'll never spam. Unsubscribe anytime."
    }
  },

  // Pain points / benefits section
  benefits: {
    title: "Tables Built for YOUR Business",
    subtitle: "Not generic templates. Not rigid structures. Your exact needs.",
    cards: [
      {
        icon: "🎯",
        title: "Perfect-Fit Tables",
        description: "Create tables that match your exact workflow. Projects, inventory, customers - designed your way, not ours."
      },
      {
        icon: "✨",
        title: "Customize Everything",
        description: "Add your exact fields - text, numbers, dates, dropdowns. Link tables together. Build exactly what you need."
      },
      {
        icon: "🔗",
        title: "Database Relationships That Work",
        description: "Link customers to orders to invoices. Connect projects to tasks to documents. Real database power, no broken links."
      },
      {
        icon: "⚡",
        title: "Lightning Fast",
        description: "Instant table creation. Instant queries. Instant sync. Everything happens in real-time, even with millions of records."
      }
    ]
  },

  // How it works section
  howItWorks: {
    title: "Your Business → Your Tables → Real Database",
    subtitle: "Design once. Use forever. Everything connected.",
    steps: [
      {
        number: "1",
        title: "Design Your Table",
        description: "Name it exactly what you need - 'Customer Orders', 'Project Milestones', 'Equipment Inventory' - anything.",
        features: [
          "Project - timelines, budgets, milestones",
          "Task - assignments, dependencies, status",
          "Record - any structured data",
          "Document, File, Activity, Discussion, Collection"
        ]
      },
      {
        number: "2",
        title: "Connect Everything",
        description: "Link your tables together with real database relationships. Customers → Orders → Payments. It all just works.",
        features: [
          "Add custom fields instantly",
          "Link projects to tasks to documents",
          "Create dependencies and hierarchies",
          "All relationships work perfectly"
        ]
      },
      {
        number: "3",
        title: "Start Using It",
        description: "That's it! Your custom table is ready. Add data, share with your team, and watch everything sync in real-time.",
        features: [
          "Instant data entry forms",
          "Beautiful table views",
          "Real-time collaboration",
          "Works on any device"
        ]
      }
    ]
  },

  // Comparison table
  comparison: {
    title: "The Difference is Clear",
    subtitle: "Custom tables with real relationships vs. generic templates",
    features: [
      {
        feature: "Custom Tables",
        elevra: "✓ Design exactly what you need",
        airtable: "✗ Force-fit into bases",
        notion: "✗ Generic databases",
        monday: "✗ Just boards"
      },
      {
        feature: "Works Offline",
        elevra: "✓ Full functionality",
        airtable: "✗ Read-only",
        notion: "✗ Limited",
        monday: "✗ No"
      },
      {
        feature: "Real DB Relationships",
        elevra: "✓ Link anything to anything",
        airtable: "✗ 15 linked records max",
        notion: "✗ Relations break",
        monday: "✗ 30+ second loads"
      },
      {
        feature: "Performance at Scale",
        elevra: "✓ No degradation",
        airtable: "✗ Slows >10k records",
        notion: "✗ Slows >5k records",
        monday: "✗ Slows >1k records"
      },
      {
        feature: "True Database",
        elevra: "✓ PostgreSQL",
        airtable: "✗ Proprietary",
        notion: "✗ Document store",
        monday: "✗ Board-based"
      }
    ]
  },

  // Final CTA
  finalCTA: {
    title: "Your Business. Your Tables. Real Database Power.",
    subtitle: "Stop forcing your data into someone else's structure",
    buttonText: "GET EARLY ACCESS"
  },

  // Footer
  footer: {
    links: [
      { text: "Privacy Policy", href: "/privacy" },
      { text: "Terms of Service", href: "/terms" },
      { text: "Security", href: "/security" },
      { text: "Contact", href: "/contact" }
    ],
    copyright: "© 2024 Elevra. Built with ❤️ for speed demons."
  }
};

export default siteContent;