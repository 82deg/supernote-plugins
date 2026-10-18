# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# ImagePlacer: PluginHost loads our native modules by class name (reactPackages
# in PluginConfig.json) and provides React Native itself at runtime. So:
# shrink unused code, but never rename anything, and keep our modules whole.
-dontobfuscate
-keep class fr.greweb.reactnativeviewshot.** { *; }
-keep class com.imageplacer.** { *; }
-dontwarn **
