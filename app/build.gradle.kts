plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.marck.tradutorlegenda"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.marck.tradutorlegenda"
        minSdk = 26
        targetSdk = 35
        versionCode = 15
        versionName = "2.8"
        ndk {
            abiFilters += listOf("arm64-v8a", "armeabi-v7a")
        }
    }

    androidResources {
        noCompress += "tflite"
    }

    signingConfigs {
        getByName("debug") {
            storeFile = file("tradutor.keystore")
            storePassword = "tradutor123"
            keyAlias = "tradutor"
            keyPassword = "tradutor123"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Leitura de texto na tela (OCR), funciona sem internet
    implementation("com.google.mlkit:text-recognition:16.0.1")
    // Tradução no próprio celular (baixa o idioma só na 1ª vez)
    implementation("com.google.mlkit:translate:17.0.3")
    // Teste: achar rosto e boca de quem fala
    implementation("com.google.mlkit:face-detection:16.1.7")
    // Teste: estimar homem/mulher pelo rosto
    implementation("org.tensorflow:tensorflow-lite:2.14.0")
    // Vozes de IA (sherpa-onnx): as bibliotecas .so são baixadas pelo GitHub Actions
}
