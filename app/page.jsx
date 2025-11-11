import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/90 backdrop-blur-sm shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-yellow-400 bg-clip-text text-transparent">
            🎁 Memora
          </div>
          <Link
            href="/login"
            className="text-blue-700 hover:text-blue-800 font-bold px-4 py-2 rounded-lg hover:bg-blue-50 transition"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-blue-400 via-blue-500 to-yellow-300 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 text-6xl opacity-20 animate-bounce">🎈</div>
        <div className="absolute top-40 right-20 text-5xl opacity-20 animate-bounce delay-100">🎉</div>
        <div className="absolute bottom-20 left-1/4 text-7xl opacity-20 animate-bounce delay-200">🎁</div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Celebrate Together,
            <br />
            <span className="text-yellow-300">Gift Better</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto">
            Create wishlists, share with friends, and receive contributions for gifts you truly want 🎊
          </p>
          <Link
            href="/login"
            className="inline-block bg-white text-blue-700 px-8 py-4 rounded-full text-lg font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
          >
            Get Started Free ✨
          </Link>
          <p className="text-white/95 mt-4 text-sm font-medium">No credit card required</p>
        </div>

        {/* Wave separator */}
        <div className="absolute bottom-0 left-0 w-full">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 text-gray-900">
            How It Works
          </h2>
          <p className="text-center text-gray-700 text-lg mb-16 font-medium">Three simple steps to better gifting</p>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-pink-50 hover:shadow-lg transition-all">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-2xl font-bold mb-3 text-blue-700">Create Your Event</h3>
              <p className="text-gray-800 font-medium">
                Add items you actually want - from Amazon, anywhere, or let AI suggest gifts for you
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-yellow-50 to-blue-50 hover:shadow-lg transition-all">
              <div className="text-6xl mb-4">🔗</div>
              <h3 className="text-2xl font-bold mb-3 text-yellow-700">Share Your Link</h3>
              <p className="text-gray-800 font-medium">
                Send your unique link to friends, family, or post on social media
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-pink-50 to-yellow-50 hover:shadow-lg transition-all">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold mb-3 text-pink-600">Celebrate!</h3>
              <p className="text-gray-800 font-medium">
                Friends contribute together. You get the money to buy exactly what you want
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Highlight */}
      <section className="py-20 px-4 bg-gradient-to-br from-yellow-100 to-pink-100">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-900">
            Why Memora?
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition">
              <div className="text-4xl mb-4">✅</div>
              <h3 className="text-xl font-bold mb-2 text-blue-700">No More Unwanted Gifts</h3>
              <p className="text-gray-800 font-medium">
                Choose exactly what you want. No more duplicate presents or things you'll never use.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-xl font-bold mb-2 text-yellow-700">Friends Contribute Together</h3>
              <p className="text-gray-800 font-medium">
                Big gift? Everyone can chip in! Track progress and see the support roll in.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition">
              <div className="text-4xl mb-4">💝</div>
              <h3 className="text-xl font-bold mb-2 text-pink-600">Keep All Contributions</h3>
              <p className="text-gray-800 font-medium">
                Even if items aren't fully funded, you keep the money. Total flexibility.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-bold mb-2 text-blue-700">AI Gift Suggestions</h3>
              <p className="text-gray-800 font-medium">
                Not sure what to add? Our AI suggests perfect gifts based on your interests.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-500 to-yellow-400 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Celebrate? 🎊
          </h2>
          <p className="text-xl mb-8 text-white/90">
            Join thousands making birthdays, weddings, and celebrations more meaningful
          </p>
          <Link
            href="/login"
            className="inline-block bg-white text-blue-700 px-8 py-4 rounded-full text-lg font-bold shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200"
          >
            Start Your Wishlist Now 🎁
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-gray-700">
          <p className="mb-2 font-medium">© 2025 Memora. Making celebrations better, one gift at a time.</p>
          <div className="flex justify-center gap-6 text-sm font-medium">
            <a href="#" className="hover:text-blue-700 text-gray-800">Privacy</a>
            <a href="#" className="hover:text-blue-700 text-gray-800">Terms</a>
            <a href="#" className="hover:text-blue-700 text-gray-800">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
