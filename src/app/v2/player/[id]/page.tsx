import { redirect } from 'next/navigation';
export default function V2PlayerRedirect({ params }: { params: { id: string } }) {
  redirect(`/player/${params.id}`);
}
