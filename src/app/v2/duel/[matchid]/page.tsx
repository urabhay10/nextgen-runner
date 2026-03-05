import { redirect } from 'next/navigation';
export default function V2DuelMatchRedirect({ params }: { params: { matchid: string } }) {
  redirect(`/duel/${params.matchid}`);
}
