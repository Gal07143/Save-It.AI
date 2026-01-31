import { Link } from 'wouter'
import { Home, ArrowLeft, Search } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Logo/Brand */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
            <Search className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-6xl font-bold text-gray-900 mb-2">404</h1>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">
            Page Not Found
          </h2>
        </div>

        {/* Description */}
        <p className="text-gray-600 mb-8">
          Sorry, we couldn't find the page you're looking for. It might have been
          moved, deleted, or never existed.
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/">
            <a className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
              <Home className="w-5 h-5" />
              Go to Dashboard
            </a>
          </Link>

          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>

        {/* Help links */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-4">
            Need help? Try these:
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/sites">
              <a className="text-blue-600 hover:text-blue-800 hover:underline">
                Sites
              </a>
            </Link>
            <Link href="/devices">
              <a className="text-blue-600 hover:text-blue-800 hover:underline">
                Devices
              </a>
            </Link>
            <Link href="/reports">
              <a className="text-blue-600 hover:text-blue-800 hover:underline">
                Reports
              </a>
            </Link>
            <Link href="/settings">
              <a className="text-blue-600 hover:text-blue-800 hover:underline">
                Settings
              </a>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 text-center">
        <p className="text-sm text-gray-400">
          SAVE-IT.AI - Energy Management Platform
        </p>
      </div>
    </div>
  )
}
