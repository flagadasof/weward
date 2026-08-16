import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY manquante.");

      return NextResponse.json(
        {
          error: "Configuration email manquante.",
        },
        {
          status: 500,
        },
      );
    }

    if (!process.env.REPORT_EMAIL) {
      console.error("REPORT_EMAIL manquante.");

      return NextResponse.json(
        {
          error: "Adresse email de réception manquante.",
        },
        {
          status: 500,
        },
      );
    }

    if (!process.env.REPORT_FROM_EMAIL) {
      console.error("REPORT_FROM_EMAIL manquante.");

      return NextResponse.json(
        {
          error: "Adresse email d'envoi manquante.",
        },
        {
          status: 500,
        },
      );
    }

    const formData = await request.formData();

    const profile = String(
      formData.get("profile") ?? "",
    ).trim();

    const reason = String(
      formData.get("reason") ?? "",
    ).trim();

    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    if (!profile) {
      return NextResponse.json(
        {
          error: "Le nom ou pseudo du profil est obligatoire.",
        },
        {
          status: 400,
        },
      );
    }

    if (!reason) {
      return NextResponse.json(
        {
          error: "Le motif du signalement est obligatoire.",
        },
        {
          status: 400,
        },
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        {
          error: `Vous pouvez joindre au maximum ${MAX_FILES} fichiers.`,
        },
        {
          status: 400,
        },
      );
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: `Le fichier "${file.name}" dépasse la taille maximale de 10 Mo.`,
          },
          {
            status: 400,
          },
        );
      }
    }

    const attachments = [];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();

      attachments.push({
        filename: file.name,
        content: Buffer.from(arrayBuffer),
      });
    }

    const html = `
      <h2>Nouveau signalement de profil</h2>

      <p>
        <strong>Profil signalé :</strong>
        ${escapeHtml(profile)}
      </p>

      <p>
        <strong>Motif :</strong>
      </p>

      <p>
        ${escapeHtml(reason).replace(/\n/g, "<br />")}
      </p>

      <hr />

      <p>
        Signalement envoyé depuis le site WeWard.
      </p>

      ${
        files.length > 0
          ? `<p><strong>Pièces jointes :</strong> ${files.length}</p>`
          : "<p>Aucune pièce jointe.</p>"
      }
    `;

    const { data, error } = await resend.emails.send({
      from: process.env.REPORT_FROM_EMAIL,
      to: [process.env.REPORT_EMAIL],
      subject: `Signalement de profil : ${profile}`,
      html,
      attachments:
        attachments.length > 0 ? attachments : undefined,
    });

    if (error) {
      console.error("Erreur Resend :", error);

      return NextResponse.json(
        {
          error: "Impossible d'envoyer le signalement.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      id: data?.id ?? null,
    });
  } catch (error) {
    console.error("Erreur signalement :", error);

    return NextResponse.json(
      {
        error: "Une erreur est survenue lors de l'envoi.",
      },
      {
        status: 500,
      },
    );
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}