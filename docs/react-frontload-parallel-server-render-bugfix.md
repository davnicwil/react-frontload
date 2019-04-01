# v1.0.6 Parallel Server Render Bugfix

### The Bug

The bug in parallel server renders meant that, if 2+ requests were made to your server more or less at the same instant, the server renders *may* have failed because they all shared the same internal state (or **context**, the term used from now on) and so, dependent on race conditions, the state *may* have become mixed between the renders, which would cause unpredictable behaviour and probably failure.

### The Fix

The fix is to isolate context to each individual server render.

Each invocation of `frontloadServerRender` should inject its own context which is created from scratch and disposed of afterwards, so that the context is never shared between different invocations and there can be arbitrarily many parallel renders happening without them interacting with each other at all.

The question is, how to do this injection of a newly created context?

Despite node having a single-threaded execution model, the problem is harder than it first appears because of the asynchronous nature of react-frontload. Because `frontloadServerRender` is asynchronous, it means that despite the single-threaded model there can indeed be multiple invocations of it not literally happening in parallel, but overlapping. If this weren't the case, the problem would be very simple, as for each call it would just be a case of using a global context object to keep the call's context, which would be wiped at the end of each call.

Incidentally, the cause of the bug in the first place was essentially that I had thought I'd discovered a clever way to use such a global variable, such that the different invocations would reference it correctly to get an isolated state, but in fact the approach was wrong and the global context *could* in fact be shared between different calls.

Anyway, to fix it a new way to get this 'global' state actually working in an isolated way for each `frontloadServerRender` invocation had to be found. If not, the fallback solution would be to simply create a new context at the start of the call and thread it through the remaining async calls. Whilst this works, the downside is that in order to work this context would also have to be *manually* passed to the `<Frontload />` provider on the server. I *really* wanted to avoid this as one of the things I liked the most about the library's API was that it was as lightweight as possible. I wanted to keep it how it was, only having to wrap the app in the `<Frontload />` provider and wrap the server render logic with `frontloadServerRender`, and have all the code beneath that just be the same.

Fortunately, from node v8.12.0, there is a rather neat solution in the native `async_hooks` package. In a nutshell, `async_hooks` can be used to track the asynchronous invocations of `frontloadServerRender` with an ID. This solves the problem, because then we *can* just have a global context object, with individual isolated contexts keyed by this ID. it's really rather simple.

That's how, in v1.0.6, it was possible to fix the bug without needing to do the manual context injection into the `<Frontload />` provider **but** it only works with node v8.12.0 and above.

### If you are using node below v8.12.0

If you are using node @ below v8.12.0, then you *will* have to make the change of injecting the context for the render into your `<Frontload />` provider on the server, due to the `async_hooks` APIs not being available, which enable this to be done automagically using global state keyed by invocation ID.

You can also do this for *any* node version, if you are concerned about the performance implications of using the `async_hooks` API. For the record, I don't consider this to be a concern for 99.9% of applications, but if it's a concern for you, rest assured that simply doing manual context injection works just the same in node v8.12.0 and above.

Here's how you do the manual context injection:

`frontloadServerRender(render(dryRun, context))` - the render callback inside `frontloadServerRender` which contains your server render logic now takes `context` as a second argument. This is the `context` object which is created with each invocation of `frontloadServerRender`, and is then passed through to the callback.

So, all you have to do is take that arg from render and pass it to your provider like so (on the server only): `<Frontload context={context}>...</Frontload>`.

Yes, it's that simple. To be honest, it's not really that big of a deal, though one of the design goals of react-frontload is to keep the API as small as possible and have everything 'just work' on top of existing applications with as minimal integration as possible. In any case, with this addition to the integration steps remain farily minimal, and if you do it wrong (don't inject the context, etc, when running node below v8.12.0) the library throws helpful Errors and tells you exactly what to do to fix it.