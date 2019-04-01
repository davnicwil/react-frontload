// NOTE - more or less copy pasted from index.js
// if code is broken up, probably should abstract this function to
// a module and just reuse it
function isNodeVersion8Dot12OrAbove () {
  const v = process.version

  const firstDotIndex = v.indexOf('.')
  const majorVersionNumber = parseInt(v.substr(1, firstDotIndex))

  if (majorVersionNumber === 8) {
    const secondDotIndex = v.lastIndexOf('.')
    const minorVersionNumber = parseInt(v.substr(firstDotIndex + 1, secondDotIndex))

    return minorVersionNumber >= 12
  } else {
    return majorVersionNumber > 8
  }
}

if (!isNodeVersion8Dot12OrAbove()) {
  console.log('\n-----\n')
  console.log('IMPORTANT\n\nYou are running node @ ' + process.version)
  console.log('\nThis means that some tests will fail, because automatic per-render context injection, which some tests rely on working to pass, is not supported below node v8.12.0')
  console.log('\n-----\n')
}
